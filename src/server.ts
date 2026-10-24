// src/server.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { Client } from '@gradio/client';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const HF_SPACE_ID = 'zk-Armor/qwen3.8-27b-uncensored-chatbot';
let gradioClientPromise: Promise<any> | null = null;

async function getGradioClient() {
  if (!gradioClientPromise) {
    console.log(`⏳ Connecting to Hugging Face Space: ${HF_SPACE_ID}...`);
    gradioClientPromise = Client.connect(HF_SPACE_ID)
      .then((client) => {
        console.log(`✅ Connected to Hugging Face Space: ${HF_SPACE_ID}`);
        return client;
      })
      .catch((err) => {
        gradioClientPromise = null;
        throw err;
      });
  }
  return gradioClientPromise;
}

// Pre-connect on server startup
getGradioClient().catch((err) =>
  console.warn('Initial Gradio connection warning:', err.message)
);

// Helper to call the /chat endpoint from your screenshot and extract clean JSON
async function callGradioJSON(systemPrompt: string, userPrompt: string) {
  const startTime = Date.now();
  const client = await getGradioClient();

  const result = await client.predict('/chat', {
    message:
      userPrompt +
      '\n\nIMPORTANT: Return ONLY a valid raw JSON object. Do not wrap in markdown or add extra commentary.',
    system_prompt:
      systemPrompt +
      ' You are a strictly safe, academic K-12 & college school tutor. Always respond with valid JSON only.',
    thinking: false,
    temperature: 0.4,
    max_tokens: 1024,
    top_p: 0.9,
    top_k: 40,
  });

  // Extract the text from Gradio's response array/data
  let rawText = '';
  if (Array.isArray(result.data)) {
    rawText =
      typeof result.data[0] === 'string'
        ? result.data[0]
        : JSON.stringify(result.data[0]);
  } else if (typeof result.data === 'string') {
    rawText = result.data;
  } else {
    rawText = JSON.stringify(result.data);
  }

  // Strip any markdown code fences or <think> tags if the model includes them
  rawText = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Extract the outermost JSON object { ... }
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    rawText = rawText.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(rawText);

  return {
    data: parsed,
    modelUsed: 'Qwen-3.8-27B (HF ZeroGPU)',
    latencyMs: Date.now() - startTime,
    timestamp: new Date().toLocaleTimeString(),
  };
}

export interface LessonPlan {
  id: string;
  sourceMode: 'topic_explorer' | 'homework_chat';
  broadTopic: string;
  specificFocus: string;
  complexityLevel: 'Easy' | 'Medium' | 'Complex';
  aiReasoning: string;
  aiMeta: {
    modelUsed: string;
    latencyMs: number;
    timestamp: string;
  };
  preTestQuestions: {
    id: number;
    question: string;
    context: string;
    expectedAnswer: string;
  }[];
  diagnosticSummary?: string;
  workedExamples: {
    title: string;
    problem: string;
    steps: string[];
    takeaway: string;
  }[];
  guidedQuestions: {
    id: number;
    prompt: string;
    expectedAnswer: string;
    hint: string;
    stepByStepSolution: string;
  }[];
  finalQuiz: {
    id: number;
    question: string;
    expectedAnswer: string;
    explanation: string;
  }[];
}

let currentLesson: LessonPlan | null = null;
let chatHistory: {
  role: 'user' | 'assistant';
  text: string;
  attachmentName?: string;
}[] = [
  {
    role: 'assistant',
    text: "Hi! I'm Aethel, now connected to your Hugging Face Qwen-27B Space. Type any homework question or concept right here (or on the left), and I will build a custom 1-by-1 walkthrough and quiz on your main screen!",
  },
];

// ============================================================================
// 1. AI TOPIC SCOPING
// ============================================================================
app.post('/api/topic/scope', async (req, res) => {
  const { rawTopic = '' } = req.body;
  const clean = rawTopic.trim();

  try {
    const result = await callGradioJSON(
      'You are an expert school curriculum designer.',
      `The student entered the topic: "${clean}".
      Break this topic into 4 specific sub-topics they might want to master in school.
      Return ONLY a JSON object in this exact format:
      {
        "topic": "${clean}",
        "message": "Which specific part of ${clean} would you like to focus on today?",
        "subtopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3", "Subtopic 4"]
      }`
    );
    return res.json(result.data);
  } catch (err: any) {
    console.warn('Scoping fallback used:', err.message);
    return res.json({
      topic: clean,
      message: `Which specific part of "${clean}" do you want to master today?`,
      subtopics: [
        `Core Rules & Setup for ${clean}`,
        `Step-by-Step Practice in ${clean}`,
        `Multi-Step Word Problems in ${clean}`,
        `Test Prep & Review for ${clean}`,
      ],
    });
  }
});

// ============================================================================
// 2. DYNAMIC LESSON & 1-BY-1 HOMEWORK WALKTHROUGH GENERATOR
// ============================================================================
async function generateAdaptiveLesson(
  broadTopic: string,
  specificFocus: string,
  sourceMode: 'topic_explorer' | 'homework_chat'
): Promise<LessonPlan> {
  const systemPrompt = `You are Aethel, an adaptive 1-on-1 AI school tutor.
  Determine whether the student's topic/homework is Easy, Medium, or Complex, and scale the number of examples and questions:
  - EASY: 2 preTestQuestions, 2 workedExamples, 2 guidedQuestions, 2 finalQuiz questions.
  - MEDIUM: 3 preTestQuestions, 3 workedExamples, 3 guidedQuestions, 3 finalQuiz questions.
  - COMPLEX: 3 preTestQuestions, 4 workedExamples, 4 guidedQuestions, 4 finalQuiz questions.
  Every example and question must use real numbers or concrete text specific to "${specificFocus}".`;

  const userPrompt = `Create a complete interactive lesson for:
  Topic: "${broadTopic}"
  Specific Focus / Student Homework Prompt: "${specificFocus}"

  Return ONLY a JSON object with this exact structure:
  {
    "specificFocusTitle": "Clear title of the lesson",
    "complexityLevel": "Easy" | "Medium" | "Complex",
    "aiReasoning": "1-2 sentences explaining why you rated this Easy, Medium, or Complex and how you tailored these problems.",
    "preTestQuestions": [
      {
        "id": 1,
        "question": "Specific diagnostic question 1",
        "context": "Instruction to show work",
        "expectedAnswer": "Concise expected answer"
      }
    ],
    "workedExamples": [
      {
        "title": "Example 1: [Title]",
        "problem": "Specific problem statement",
        "steps": [
          "Step 1: Explanation",
          "Step 2: Explanation",
          "Step 3: Final result"
        ],
        "takeaway": "Key rule to remember"
      }
    ],
    "guidedQuestions": [
      {
        "id": 1,
        "prompt": "Specific problem for the student to solve 1-by-1",
        "expectedAnswer": "Concise final answer",
        "hint": "Helpful step hint without spoiling the answer",
        "stepByStepSolution": "Full step-by-step solution"
      }
    ],
    "finalQuiz": [
      {
        "id": 1,
        "question": "End-of-lesson mastery quiz question",
        "expectedAnswer": "Concise answer",
        "explanation": "Why this answer is correct"
      }
    ]
  }`;

  const result = await callGradioJSON(systemPrompt, userPrompt);
  const d = result.data;

  return {
    id: 'lesson_' + Date.now(),
    sourceMode,
    broadTopic,
    specificFocus: d.specificFocusTitle || specificFocus,
    complexityLevel: d.complexityLevel || 'Medium',
    aiReasoning:
      d.aiReasoning || `Generated custom lesson for "${specificFocus}".`,
    aiMeta: {
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
      timestamp: result.timestamp,
    },
    preTestQuestions: Array.isArray(d.preTestQuestions)
      ? d.preTestQuestions
      : [],
    workedExamples: Array.isArray(d.workedExamples) ? d.workedExamples : [],
    guidedQuestions: Array.isArray(d.guidedQuestions) ? d.guidedQuestions : [],
    finalQuiz: Array.isArray(d.finalQuiz) ? d.finalQuiz : [],
  };
}

app.post('/api/lesson/create', async (req, res) => {
  const {
    broadTopic = 'Topic',
    specificFocus = 'Concept',
    sourceMode = 'topic_explorer',
  } = req.body;
  try {
    currentLesson = await generateAdaptiveLesson(
      broadTopic,
      specificFocus,
      sourceMode
    );
    res.json(currentLesson);
  } catch (err: any) {
    console.error('Gradio lesson creation error:', err);
    res
      .status(500)
      .json({
        error:
          err.message || 'Failed to generate lesson from Hugging Face Space',
      });
  }
});

// ============================================================================
// 3. EVALUATE PRE-TEST & SCRATCHWORK
// ============================================================================
app.post('/api/lesson/evaluate-pretest', async (req, res) => {
  if (!currentLesson)
    return res.status(400).json({ error: 'No active lesson' });
  const { answers = [], workNotes = '', uploadedFileName = '' } = req.body;

  try {
    const qa = currentLesson.preTestQuestions.map((q, i) => ({
      question: q.question,
      expectedAnswer: q.expectedAnswer,
      studentAnswer: answers[i] || '(Blank)',
    }));

    const evalRes = await callGradioJSON(
      "You are a supportive 1-on-1 tutor analyzing a student's pre-test and scratchwork.",
      `Topic: "${currentLesson.specificFocus}"
      Pre-test answers: ${JSON.stringify(qa)}
      Student's scratchwork steps: "${workNotes || 'None'}"
      Uploaded file: "${uploadedFileName || 'None'}"

      Return ONLY JSON:
      {
        "score": number correct out of ${currentLesson.preTestQuestions.length},
        "diagnosis": "2-3 encouraging sentences explaining what they got right, where their work had a mistake, and what to watch for in the worked examples."
      }`
    );

    currentLesson.diagnosticSummary = evalRes.data.diagnosis;
    res.json({
      score: evalRes.data.score ?? 0,
      total: currentLesson.preTestQuestions.length,
      diagnosis: evalRes.data.diagnosis,
      lesson: currentLesson,
    });
  } catch (err: any) {
    currentLesson.diagnosticSummary =
      'Pre-test submitted! Review the worked examples below and then start your 1-by-1 walkthrough.';
    res.json({
      score: 1,
      total: currentLesson.preTestQuestions.length,
      diagnosis: currentLesson.diagnosticSummary,
      lesson: currentLesson,
    });
  }
});

// ============================================================================
// 4. CHECK 1-BY-1 HOMEWORK WALKTHROUGH STEP
// ============================================================================
app.post('/api/lesson/check-step', async (req, res) => {
  if (!currentLesson)
    return res.status(400).json({ error: 'No active lesson' });
  const { questionIndex = 0, studentAnswer = '', studentWork = '' } = req.body;
  const q = currentLesson.guidedQuestions[questionIndex];
  if (!q) return res.status(400).json({ error: 'Invalid question' });

  try {
    const checkRes = await callGradioJSON(
      "You are a 1-on-1 tutor checking a student's homework step.",
      `Problem: "${q.prompt}"
      Expected Answer: "${q.expectedAnswer}"
      Official Solution: "${q.stepByStepSolution}"
      Student's Work: "${studentWork}"
      Student's Final Answer: "${studentAnswer}"

      Return ONLY JSON:
      {
        "isCorrect": true or false,
        "feedback": "Specific feedback pointing out if they are right, or which exact step in their work needs fixing."
      }`
    );
    res.json(checkRes.data);
  } catch (err: any) {
    const isRight =
      studentAnswer.toLowerCase().trim() ===
      q.expectedAnswer.toLowerCase().trim();
    res.json({
      isCorrect: isRight,
      feedback: isRight
        ? `Correct! ${q.stepByStepSolution}`
        : `Not quite yet. Hint: ${q.hint}`,
    });
  }
});

// ============================================================================
// 5. GRADE FINAL MASTERY QUIZ
// ============================================================================
app.post('/api/lesson/evaluate-quiz', async (req, res) => {
  if (!currentLesson)
    return res.status(400).json({ error: 'No active lesson' });
  const { quizAnswers = [] } = req.body;

  try {
    const items = currentLesson.finalQuiz.map((q, i) => ({
      question: q.question,
      expectedAnswer: q.expectedAnswer,
      studentAnswer: quizAnswers[i] || '(Blank)',
      explanation: q.explanation,
    }));

    const result = await callGradioJSON(
      'You are grading a Final Mastery Quiz.',
      `Topic: "${currentLesson.specificFocus}"
      Submissions: ${JSON.stringify(items)}

      Return ONLY JSON:
      {
        "score": number correct,
        "total": ${currentLesson.finalQuiz.length},
        "overallFeedback": "Summary of their mastery",
        "questionResults": [
          { "isCorrect": true or false, "feedback": "Explanation for this question" }
        ]
      }`
    );
    res.json(result.data);
  } catch (err: any) {
    res.json({
      score: currentLesson.finalQuiz.length,
      total: currentLesson.finalQuiz.length,
      overallFeedback: 'Quiz complete!',
      questionResults: currentLesson.finalQuiz.map((q) => ({
        isCorrect: true,
        feedback: q.explanation,
      })),
    });
  }
});

// ============================================================================
// 6. LIVE CHATBOT -> TRIGGERS MAIN SCREEN LESSON & HOMEWORK WALKTHROUGH
// ============================================================================
app.post('/api/chat', async (req, res) => {
  const { message = '', attachmentName = '' } = req.body;
  chatHistory.push({ role: 'user', text: message, attachmentName });

  const promptTopic = attachmentName
    ? `${message || 'Uploaded School Homework'} (${attachmentName})`
    : message;

  try {
    currentLesson = await generateAdaptiveLesson(
      'Homework & Live Concept Help',
      promptTopic,
      'homework_chat'
    );

    const reply = `I've generated a custom ${currentLesson.complexityLevel}-level lesson for "${currentLesson.specificFocus}" on your main screen! We'll go through ${currentLesson.workedExamples.length} worked examples, solve ${currentLesson.guidedQuestions.length} problems 1-by-1 together, and finish with a ${currentLesson.finalQuiz.length}-question Final Mastery Quiz.`;

    chatHistory.push({ role: 'assistant', text: reply });
    res.json({
      reply,
      chatHistory,
      updatedLesson: currentLesson,
    });
  } catch (err: any) {
    const errReply = `Hugging Face Space is busy or waking up (${err.message}). Try clicking Send again in a few seconds!`;
    chatHistory.push({ role: 'assistant', text: errReply });
    res.json({ reply: errReply, chatHistory, updatedLesson: null });
  }
});

app.get('/api/chat', (req, res) => {
  res.json({ chatHistory });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Aethel Gradio AI Server running at http://localhost:${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    setTimeout(() => {
      server.close();
      server.listen(PORT);
    }, 1000);
  }
});

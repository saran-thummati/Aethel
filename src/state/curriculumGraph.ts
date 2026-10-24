// src/state/curriculumGraph.ts
import { z } from 'zod';
import { MicroSkillSchema } from './primerSchema';

export type MicroSkill = z.infer<typeof MicroSkillSchema>;

export const READING_CURRICULUM: MicroSkill[] = [
  {
    skill_id: 'phonics_cvce_long_a',
    description: "Silent 'e' makes the vowel 'a' say its own name (/ā/)",
    mastery_probability: 0.45,
    target_items: ['cape', 'gate', 'lake'],
    completed_items: [],
    recent_errors: [],
  },
  {
    skill_id: 'phonics_digraph_sh_ch',
    description: "Consonant digraphs 'sh' and 'ch' (two letters, one sound)",
    mastery_probability: 0.4,
    target_items: ['ship', 'chat', 'path'],
    completed_items: [],
    recent_errors: [],
  },
  {
    skill_id: 'phonics_vowel_teams_ai',
    description:
      "Vowel team 'ai' (when two vowels go walking, the first one does the talking)",
    mastery_probability: 0.4,
    target_items: ['rain', 'sail', 'trail'],
    completed_items: [],
    recent_errors: [],
  },
];

export const MATH_CURRICULUM: MicroSkill[] = [
  {
    skill_id: 'math_number_bonds_10',
    description:
      'Number Bonds to 10 (finding the missing partner to fill a 10-frame)',
    mastery_probability: 0.5,
    target_items: ['4+6=10', '7+3=10', '2+8=10'],
    completed_items: [],
    recent_errors: [],
  },
  {
    skill_id: 'math_make_10_addition',
    description: 'Decomposing numbers to bridge across 10',
    mastery_probability: 0.45,
    target_items: ['8+2=10', '3+7=10', '5+5=10'],
    completed_items: [],
    recent_errors: [],
  },
  {
    skill_id: 'math_teen_place_value',
    description: 'Base-10 Place Value (10 and some more)',
    mastery_probability: 0.45,
    target_items: ['6+4=10', '9+1=10', '1+9=10'],
    completed_items: [],
    recent_errors: [],
  },
];

export function getNextSkill(
  currentSkillId: string,
  track: 'reading' | 'math'
): MicroSkill | null {
  const list = track === 'reading' ? READING_CURRICULUM : MATH_CURRICULUM;
  const idx = list.findIndex((s) => s.skill_id === currentSkillId);
  if (idx !== -1 && idx + 1 < list.length) {
    return structuredClone(list[idx + 1]);
  }
  return null;
}

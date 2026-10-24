// src/state/primerSchema.ts
import { z } from 'zod';

export const ChildProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().min(3).max(12),
  interests: z.array(z.string()),
  companions: z.array(
    z.object({
      name: z.string(),
      species_or_type: z.string(),
      personality: z.string(),
      visual_description: z.string(),
    })
  ),
  temperament: z.object({
    frustration_threshold: z.number().int().min(1).max(5),
    preferred_scaffolding: z.enum([
      'visual',
      'phonetic_breakdown',
      'rhyming',
      'story_clue',
    ]),
    notes: z.string(),
  }),
});

export const MicroSkillSchema = z.object({
  skill_id: z.string(),
  description: z.string(),
  mastery_probability: z.number().min(0).max(1),
  target_items: z.array(z.string()),
  completed_items: z.array(z.string()),
  recent_errors: z.array(z.string()),
});

export const PedagogicalStateSchema = z.object({
  active_reading_skill: MicroSkillSchema,
  active_math_skill: MicroSkillSchema,
  current_focus: z.enum(['reading', 'math', 'story_choice']),
  consecutive_failures: z.number().int().min(0),
  active_scaffold_level: z.number().int().min(0).max(3),
});

export const StoryStateSchema = z.object({
  chapter: z.number().int(),
  page: z.number().int(),
  world_setting: z.string(),
  current_location: z.string(),
  active_dilemma: z.string(),
  inventory: z.array(z.string()),
  story_summary_so_far: z.array(z.string()),
  last_child_action: z.string(),
});

export const PrimerStateSchema = z.object({
  child_profile: ChildProfileSchema,
  pedagogical_state: PedagogicalStateSchema,
  story_state: StoryStateSchema,
  updated_at: z.string(),
});

export type PrimerState = z.infer<typeof PrimerStateSchema>;

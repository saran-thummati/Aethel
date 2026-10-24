// src/state/seedState.ts
import { PrimerState } from './primerSchema';

export const initialLeoState: PrimerState = {
  child_profile: {
    id: 'child_leo_001',
    name: 'Leo',
    age: 6,
    interests: ['dinosaurs', 'space exploration', 'volcanoes'],
    companions: [
      {
        name: 'Captain Rex',
        species_or_type: 'Small green Triceratops in a brass spacesuit',
        personality: 'Curious, slightly clumsy, afraid of the dark',
        visual_description:
          'A cute small green triceratops wearing a vintage brass and glass astronaut helmet, watercolor storybook style',
      },
    ],
    temperament: {
      frustration_threshold: 2,
      preferred_scaffolding: 'phonetic_breakdown',
      notes: 'Loves slapstick humor; gets quiet when unsure.',
    },
  },
  pedagogical_state: {
    active_reading_skill: {
      skill_id: 'phonics_cvce_long_a',
      description: "Silent 'e' at the end makes the vowel 'a' say its own name",
      mastery_probability: 0.4,
      target_items: ['cape', 'gate', 'lake', 'cave', 'tape'],
      completed_items: [],
      recent_errors: [],
    },
    active_math_skill: {
      skill_id: 'math_number_bonds_10',
      description: 'Finding the missing addend to make 10 (e.g., 4 + ? = 10)',
      mastery_probability: 0.5,
      target_items: ['4+6=10', '7+3=10', '2+8=10', '5+5=10'],
      completed_items: [],
      recent_errors: [],
    },
    current_focus: 'reading',
    consecutive_failures: 0,
    active_scaffold_level: 0,
  },
  story_state: {
    chapter: 1,
    page: 1,
    world_setting: 'Planet Zog, a red crystal world with ancient stone ruins',
    current_location: 'The Broken Bridge over the Lava Canyon',
    active_dilemma:
      'Captain Rex needs to cross the gap to reach the Crystal Gate',
    inventory: ['Starlight Compass'],
    story_summary_so_far: [
      'Leo and Captain Rex landed their ship on Planet Zog.',
      'They discovered a broken bridge blocking the path to the Crystal Gate.',
    ],
    last_child_action: 'Opened the book to start Chapter 1.',
  },
  updated_at: new Date().toISOString(),
};

// src/state/stateMachine.ts
import fs from 'fs';
import path from 'path';
import { PrimerState, PrimerStateSchema } from './primerSchema';
import { initialLeoState } from './seedState';

const STATE_FILE_PATH = path.join(process.cwd(), 'primer_state.json');

export function loadState(): PrimerState {
  if (!fs.existsSync(STATE_FILE_PATH)) {
    saveState(initialLeoState);
    return initialLeoState;
  }
  const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
  return PrimerStateSchema.parse(JSON.parse(raw));
}

export function saveState(state: PrimerState): void {
  state.updated_at = new Date().toISOString();
  const validated = PrimerStateSchema.parse(state);
  fs.writeFileSync(
    STATE_FILE_PATH,
    JSON.stringify(validated, null, 2),
    'utf-8'
  );
}

function updateMasteryScore(
  currentScore: number,
  succeeded: boolean,
  scaffoldLevelUsed: number
): number {
  if (succeeded) {
    const gain =
      scaffoldLevelUsed === 0 ? 0.18 : scaffoldLevelUsed === 1 ? 0.08 : 0.02;
    return Math.min(
      0.99,
      Number((currentScore + gain * (1 - currentScore)).toFixed(2))
    );
  } else {
    return Math.max(0.1, Number((currentScore * 0.85).toFixed(2)));
  }
}

export function recordChildAttempt(
  state: PrimerState,
  params: {
    targetItem: string;
    childResponse: string;
    succeeded: boolean;
  }
): PrimerState {
  const next = structuredClone(state);
  const ped = next.pedagogical_state;
  const activeSkill =
    ped.current_focus === 'reading'
      ? ped.active_reading_skill
      : ped.active_math_skill;

  activeSkill.mastery_probability = updateMasteryScore(
    activeSkill.mastery_probability,
    params.succeeded,
    ped.active_scaffold_level
  );

  if (params.succeeded) {
    activeSkill.target_items = activeSkill.target_items.filter(
      (i) => i !== params.targetItem
    );
    if (!activeSkill.completed_items.includes(params.targetItem)) {
      activeSkill.completed_items.push(params.targetItem);
    }

    ped.consecutive_failures = 0;
    ped.active_scaffold_level = 0;
    next.story_state.page += 1;
    next.story_state.last_child_action = `Successfully solved '${params.targetItem}' with response '${params.childResponse}'.`;
    ped.current_focus = ped.current_focus === 'reading' ? 'math' : 'reading';
  } else {
    activeSkill.recent_errors.push(
      `Target '${params.targetItem}' -> Child said '${params.childResponse}'`
    );
    ped.consecutive_failures += 1;
    ped.active_scaffold_level = Math.min(3, ped.consecutive_failures);
    next.story_state.last_child_action = `Struggled with '${params.targetItem}' (said '${params.childResponse}'). Needs Scaffold Level ${ped.active_scaffold_level}.`;
  }

  saveState(next);
  return next;
}

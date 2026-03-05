export const AI_TOOLS = {
  get_workout_summary: {
    description: 'Return workout summary rows from recent_workouts_summary view',
    args: {
      limit: { type: 'integer', min: 1, max: 50, default: 30 }
    }
  },
  get_exercise_progress: {
    description: 'Return progress rows for a specific exercise',
    args: {
      exercise_id: { type: 'uuid', required: true },
      limit: { type: 'integer', min: 1, max: 50, default: 20 }
    }
  },
  list_recent_workouts: {
    description: 'Return recent workouts from workouts table excluding soft-deleted rows',
    args: {
      limit: { type: 'integer', min: 1, max: 50, default: 10 }
    }
  }
};

export function getToolDefinition(toolName) {
  return AI_TOOLS[toolName] || null;
}

export function getSupportedToolNames() {
  return Object.keys(AI_TOOLS);
}

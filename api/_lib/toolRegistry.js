export const TOOL_REGISTRY = {
  getWorkoutHistory: {
    description: 'Returns recent workouts for the configured single user',
    args: {
      limit: { type: 'number', integer: true, min: 1, max: 50, default: 30 }
    }
  },
  getExerciseProgress: {
    description: 'Returns exercise progress metrics for a specific exercise',
    args: {
      exercise_id: { type: 'uuid', required: true },
      limit: { type: 'number', integer: true, min: 1, max: 50, default: 20 }
    }
  },
  logSet: {
    description: 'Logs a workout set and computes set_order on the server',
    args: {
      workout_id: { type: 'uuid', required: true },
      exercise_id: { type: 'uuid', required: true },
      weight_kg: { type: 'number', required: true, min: 0 },
      reps: { type: 'number', required: true, integer: true, min: 1 },
      rpe: { type: 'number', min: 1, max: 10 }
    }
  },
  createTrainingPlan: {
    description: 'Creates a minimal workout plan skeleton without plan_exercises',
    args: {
      name: { type: 'string', default: 'AI Training Plan' },
      description: { type: 'string' },
      goal: {
        type: 'string',
        enum: ['strength', 'hypertrophy', 'endurance', 'general']
      },
      days_per_week: { type: 'number', integer: true, min: 1, max: 7, default: 3 },
      duration_weeks: { type: 'number', integer: true, min: 1, max: 52, default: 8 }
    }
  }
};

export function getToolDefinition(toolName) {
  return TOOL_REGISTRY[toolName] || null;
}

export function getSupportedTools() {
  return Object.keys(TOOL_REGISTRY);
}

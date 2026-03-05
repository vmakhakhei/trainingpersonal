import { describe, expect, it } from 'vitest';
import { ToolExecutionError, validateToolInput } from '../../api/_lib/toolExecutor.js';

describe('tool input validation', () => {
  it('applies defaults for getWorkoutHistory', () => {
    const args = validateToolInput('getWorkoutHistory', {});
    expect(args).toEqual({ limit: 30 });
  });

  it('rejects unsupported tool', () => {
    expect(() => validateToolInput('unknownTool', {})).toThrowError(ToolExecutionError);

    try {
      validateToolInput('unknownTool', {});
    } catch (error) {
      expect(error.code).toBe('INVALID_TOOL');
    }
  });

  it('rejects invalid UUID for getExerciseProgress', () => {
    expect(() =>
      validateToolInput('getExerciseProgress', {
        exercise_id: 'not-uuid'
      })
    ).toThrowError(ToolExecutionError);
  });

  it('validates logSet numeric constraints', () => {
    expect(() =>
      validateToolInput('logSet', {
        workout_id: '123e4567-e89b-42d3-a456-426614174000',
        exercise_id: '123e4567-e89b-42d3-a456-426614174001',
        weight_kg: -1,
        reps: 5
      })
    ).toThrowError(ToolExecutionError);

    expect(() =>
      validateToolInput('logSet', {
        workout_id: '123e4567-e89b-42d3-a456-426614174000',
        exercise_id: '123e4567-e89b-42d3-a456-426614174001',
        weight_kg: 100,
        reps: 0
      })
    ).toThrowError(ToolExecutionError);
  });
});

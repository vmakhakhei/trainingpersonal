import { describe, expect, it } from 'vitest';
import { createAiSuggestHandler } from '../../api/ai/suggest.js';

function createMockRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('ai suggest endpoint', () => {
  it('returns autofill suggestion with expected schema', async () => {
    const handler = createAiSuggestHandler({
      getUserId: () => '123e4567-e89b-42d3-a456-426614174000',
      getRecentSetsForExercise: async () => [{ weight_kg: 100, reps: 8, rpe: 8 }],
      logSuggestRequest: async () => {},
      randomUUID: () => '11111111-1111-4111-8111-111111111111'
    });

    const res = createMockRes();

    await handler(
      {
        method: 'POST',
        body: {
          prompt_type: 'autofill_set',
          context: {
            exercise_id: '123e4567-e89b-42d3-a456-426614174011',
            workout_id: '123e4567-e89b-42d3-a456-426614174010'
          }
        }
      },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trace_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions[0]).toMatchObject({
      type: 'autofill',
      confidence: 0.9,
      payload: {
        weight_kg: 100,
        reps: 8,
        rpe: 8
      }
    });
  });

  it('returns session summary suggestion payload', async () => {
    const handler = createAiSuggestHandler({
      getUserId: () => '123e4567-e89b-42d3-a456-426614174000',
      getWorkoutSets: async () => [
        {
          exercise_id: '123e4567-e89b-42d3-a456-426614174011',
          weight_kg: 80,
          reps: 8,
          rpe: 8,
          exercises: { name_ru: 'Жим лёжа', primary_muscle: 'chest' }
        },
        {
          exercise_id: '123e4567-e89b-42d3-a456-426614174011',
          weight_kg: 80,
          reps: 8,
          rpe: 8,
          exercises: { name_ru: 'Жим лёжа', primary_muscle: 'chest' }
        }
      ],
      logSuggestRequest: async () => {},
      randomUUID: () => '22222222-2222-4222-8222-222222222222'
    });

    const res = createMockRes();

    await handler(
      {
        method: 'POST',
        body: {
          prompt_type: 'session_summary',
          context: {
            workout_id: '123e4567-e89b-42d3-a456-426614174010'
          }
        }
      },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions[0].confidence).toBe(0.8);
    expect(res.body.suggestions[0].payload).toEqual(
      expect.objectContaining({
        summary: expect.any(String),
        highlights: expect.any(Array),
        suggestions: expect.any(Array)
      })
    );
  });
});

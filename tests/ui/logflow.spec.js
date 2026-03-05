import { describe, expect, it, vi } from 'vitest';
import {
  applyWeightChange,
  requestAutofillSuggestion,
  requestSessionSummary
} from '../../src/lib/aiSuggest.js';

function createResponse({
  status = 200,
  ok = true,
  contentType = 'application/json',
  body = '{}'
}) {
  return {
    status,
    ok,
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null)
    },
    text: async () => body
  };
}

describe('log workout ai flow', () => {
  it('mocks /api/ai/suggest for autofill_set flow', async () => {
    const fetchMock = vi.fn(async () =>
      createResponse({
        status: 200,
        ok: true,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          prompt_type: 'autofill_set',
          suggestions: [
            {
              id: 's1',
              type: 'autofill',
              payload: { weight_kg: 100, reps: 8, rpe: 8 },
              confidence: 0.9,
              explain: 'последний подход был 100×8',
              sources: []
            }
          ]
        })
      })
    );

    const suggestion = await requestAutofillSuggestion({
      exerciseId: 'exercise-1',
      workoutId: 'workout-1',
      recentSets: [{ weight_kg: 95, reps: 8, rpe: 8 }],
      fetchImpl: fetchMock,
      endpoint: 'https://api.example.com/ai/suggest'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/ai/suggest');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({
      prompt_type: 'autofill_set',
      context: {
        exercise_id: 'exercise-1',
        workout_id: 'workout-1'
      }
    });

    expect(suggestion).toMatchObject({
      type: 'autofill',
      confidence: 0.9,
      payload: { weight_kg: 100, reps: 8, rpe: 8 }
    });
  });

  it('falls back to local autofill when /api/ai/suggest is unavailable', async () => {
    const fetchMock = vi.fn(async () =>
      createResponse({
        status: 404,
        ok: false,
        contentType: 'text/html',
        body: '<html>Not Found</html>'
      })
    );

    const suggestion = await requestAutofillSuggestion({
      exerciseId: 'exercise-1',
      workoutId: 'workout-1',
      recentSets: [{ weight_kg: 62.5, reps: 10, rpe: 8 }],
      fetchImpl: fetchMock,
      endpoint: '/api/ai/suggest'
    });

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(suggestion).toMatchObject({
      type: 'autofill',
      payload: { weight_kg: 62.5, reps: 10, rpe: 8 }
    });
  });

  it('parses session_summary payload from /api/ai/suggest', async () => {
    const fetchMock = vi.fn(async () =>
      createResponse({
        status: 200,
        ok: true,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          prompt_type: 'session_summary',
          suggestions: [
            {
              id: 's1',
              type: 'session_summary',
              payload: {
                summary: 'Сегодня хороший объём на грудь',
                highlights: ['Подходов: 8'],
                suggestions: ['Сохраните текущий темп прогрессии']
              },
              confidence: 0.8,
              explain: 'heuristic summary',
              sources: []
            }
          ]
        })
      })
    );

    const summary = await requestSessionSummary({
      workoutId: 'workout-1',
      fetchImpl: fetchMock,
      endpoint: 'https://api.example.com/ai/suggest'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      summary: 'Сегодня хороший объём на грудь',
      highlights: ['Подходов: 8'],
      suggestions: ['Сохраните текущий темп прогрессии']
    });
  });

  it('falls back to local summary when /api/ai/suggest is unavailable', async () => {
    const fetchMock = vi.fn(async () =>
      createResponse({
        status: 404,
        ok: false,
        contentType: 'text/html',
        body: '<html>Not Found</html>'
      })
    );

    const summary = await requestSessionSummary({
      workoutId: 'workout-1',
      recentSets: [
        { weight_kg: 60, reps: 10, rpe: 7 },
        { weight_kg: 65, reps: 8, rpe: 8 }
      ],
      fetchImpl: fetchMock,
      endpoint: '/api/ai/suggest'
    });

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(summary).toEqual(
      expect.objectContaining({
        summary: expect.any(String),
        highlights: expect.any(Array),
        suggestions: expect.any(Array)
      })
    );
  });

  it('applies +5% and -5% quick actions deterministically', () => {
    expect(
      applyWeightChange({
        currentWeight: '100',
        fallbackWeight: null,
        multiplier: 1.05
      })
    ).toBe('105');

    expect(
      applyWeightChange({
        currentWeight: '',
        fallbackWeight: 100,
        multiplier: 0.95
      })
    ).toBe('95');
  });
});

import { describe, expect, it } from 'vitest';
import { createAiProxyHandler } from '../../api/ai/proxy.js';

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

describe('AI proxy tool_call flow', () => {
  it('executes tool call and returns top-level contract', async () => {
    const handler = createAiProxyHandler({
      getUserId: () => '123e4567-e89b-42d3-a456-426614174000',
      checkRateLimit: async () => {},
      getCachedResponse: async () => null,
      cacheResponse: async () => {},
      logRequest: async () => {},
      fetchDeepSeek: async () => ({
        choices: [
          {
            message: {
              content: '{"answer":"Готово","sources":[],"confidence":0.9}',
              tool_calls: [
                {
                  function: {
                    name: 'getWorkoutHistory',
                    arguments: '{"limit":1}'
                  }
                }
              ]
            }
          }
        ]
      }),
      executeToolRequest: async () => ({
        success: true,
        tool_call: {
          name: 'getWorkoutHistory',
          input: { limit: 1 }
        },
        tool_result: {
          items: [{ id: 'workout-1' }]
        }
      })
    });

    const res = createMockRes();

    await handler(
      {
        method: 'POST',
        body: {
          prompt: 'Покажи последние тренировки',
          context: {}
        }
      },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      tool_call: {
        name: 'getWorkoutHistory',
        input: { limit: 1 }
      },
      tool_result: {
        items: [{ id: 'workout-1' }]
      },
      answer: 'Готово',
      sources: [],
      cached: false,
      confidence: 0.9
    });
  });

  it('returns deterministic timeout error shape', async () => {
    const handler = createAiProxyHandler({
      getUserId: () => '123e4567-e89b-42d3-a456-426614174000',
      checkRateLimit: async () => {},
      getCachedResponse: async () => null,
      cacheResponse: async () => {},
      logRequest: async () => {},
      fetchDeepSeek: async () => {
        const error = new Error('DeepSeek request timed out after 8000ms');
        error.statusCode = 504;
        error.code = 'LLM_TIMEOUT';
        throw error;
      }
    });

    const res = createMockRes();

    await handler(
      {
        method: 'POST',
        body: {
          prompt: 'test',
          context: {}
        }
      },
      res
    );

    expect(res.statusCode).toBe(504);
    expect(res.body).toEqual({
      success: false,
      error: 'DeepSeek request timed out after 8000ms',
      code: 'LLM_TIMEOUT'
    });
  });
});

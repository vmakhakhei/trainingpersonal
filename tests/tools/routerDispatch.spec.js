import { describe, expect, it, vi } from 'vitest';
import { createToolsHandler } from '../../api/tools.js';
import { ToolExecutionError } from '../../api/_lib/toolExecutor.js';

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

describe('tools router', () => {
  it('returns 405 for non-POST requests', async () => {
    const handler = createToolsHandler();
    const res = createMockRes();

    await handler({ method: 'GET', body: {} }, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({
      success: false,
      code: 'METHOD_NOT_ALLOWED'
    });
  });

  it('dispatches valid tool call and returns unified response', async () => {
    const executeToolRequest = vi.fn(async () => ({
      success: true,
      tool_call: { name: 'getWorkoutHistory', input: { limit: 5 } },
      tool_result: { items: [{ id: 'w1' }] }
    }));

    const handler = createToolsHandler({
      getUserId: () => '123e4567-e89b-42d3-a456-426614174000',
      checkToolsRateLimit: async () => {},
      executeToolRequest,
      logToolsRequest: async () => {}
    });

    const res = createMockRes();

    await handler(
      {
        method: 'POST',
        body: {
          tool: 'getWorkoutHistory',
          arguments: { limit: 5 }
        }
      },
      res
    );

    expect(executeToolRequest).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      tool_call: { name: 'getWorkoutHistory', input: { limit: 5 } },
      tool_result: { items: [{ id: 'w1' }] }
    });
  });

  it('returns 400 for invalid tool', async () => {
    const handler = createToolsHandler({
      getUserId: () => '123e4567-e89b-42d3-a456-426614174000',
      checkToolsRateLimit: async () => {},
      executeToolRequest: async () => {
        throw new ToolExecutionError('Unsupported tool', 'INVALID_TOOL', 400);
      },
      logToolsRequest: async () => {}
    });

    const res = createMockRes();

    await handler(
      {
        method: 'POST',
        body: {
          tool: 'unknownTool',
          arguments: {}
        }
      },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Unsupported tool',
      code: 'INVALID_TOOL'
    });
  });
});

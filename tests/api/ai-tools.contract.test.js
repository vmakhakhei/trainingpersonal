import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ToolValidationError } from '../../api/_lib/aiToolsValidation.js';

let createAiToolsHandler;

function createMockRes() {
  const headers = {};

  return {
    headers,
    statusCode: null,
    body: null,
    setHeader(key, value) {
      headers[key] = value;
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

before(async () => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.VITE_SINGLE_USER_ID = '123e4567-e89b-42d3-a456-426614174000';

  ({ createAiToolsHandler } = await import('../../api/ai/tools.js'));
});

test('handler returns 405 for non-POST methods', async () => {
  const handler = createAiToolsHandler();
  const req = { method: 'GET', body: {} };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.body, {
    success: false,
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED'
  });
});

test('handler returns 200 for valid tool execution', async () => {
  let now = 1000;
  const handler = createAiToolsHandler({
    getUserId: () => 'user-1',
    checkRateLimit: async () => {},
    validateToolRequest: () => ({
      tool: 'list_recent_workouts',
      arguments: { limit: 2 }
    }),
    executeTool: async () => [{ id: 'w1' }, { id: 'w2' }],
    logToolRequest: async () => {},
    now: () => {
      now += 7;
      return now;
    },
    isoNow: () => '2026-03-05T09:00:00.000Z'
  });

  const req = { method: 'POST', body: { tool: 'list_recent_workouts' } };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.tool, 'list_recent_workouts');
  assert.deepEqual(res.body.data.arguments, { limit: 2 });
  assert.equal(res.body.data.meta.executed_at, '2026-03-05T09:00:00.000Z');
  assert.equal(res.body.data.meta.row_count, 2);
});

test('handler returns 400 on validation errors', async () => {
  const handler = createAiToolsHandler({
    getUserId: () => 'user-1',
    checkRateLimit: async () => {},
    validateToolRequest: () => {
      throw new ToolValidationError('Invalid payload');
    },
    executeTool: async () => [],
    logToolRequest: async () => {}
  });

  const req = { method: 'POST', body: {} };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'VALIDATION_ERROR');
});

test('handler returns 429 when rate limit is exceeded', async () => {
  const handler = createAiToolsHandler({
    getUserId: () => 'user-1',
    checkRateLimit: async () => {
      const error = new Error('Rate limit exceeded');
      error.statusCode = 429;
      error.code = 'RATE_LIMIT_EXCEEDED';
      throw error;
    },
    validateToolRequest: () => ({ tool: 'get_workout_summary', arguments: { limit: 1 } }),
    executeTool: async () => [],
    logToolRequest: async () => {}
  });

  const req = { method: 'POST', body: { tool: 'get_workout_summary' } };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'RATE_LIMIT_EXCEEDED');
});

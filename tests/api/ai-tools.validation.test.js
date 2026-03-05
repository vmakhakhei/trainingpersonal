import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ToolValidationError, validateToolRequest } from '../../api/_lib/aiToolsValidation.js';

test('validateToolRequest applies defaults for get_workout_summary', () => {
  const payload = validateToolRequest({ tool: 'get_workout_summary' });

  assert.equal(payload.tool, 'get_workout_summary');
  assert.deepEqual(payload.arguments, { limit: 30 });
});

test('validateToolRequest applies defaults for list_recent_workouts', () => {
  const payload = validateToolRequest({ tool: 'list_recent_workouts', arguments: {} });

  assert.equal(payload.tool, 'list_recent_workouts');
  assert.deepEqual(payload.arguments, { limit: 10 });
});

test('validateToolRequest validates exercise progress arguments', () => {
  const payload = validateToolRequest({
    tool: 'get_exercise_progress',
    arguments: {
      exercise_id: '123e4567-e89b-42d3-a456-426614174000',
      limit: '25'
    }
  });

  assert.equal(payload.tool, 'get_exercise_progress');
  assert.deepEqual(payload.arguments, {
    exercise_id: '123e4567-e89b-42d3-a456-426614174000',
    limit: 25
  });
});

test('validateToolRequest rejects unsupported tools', () => {
  assert.throws(
    () => validateToolRequest({ tool: 'delete_everything' }),
    (error) => error instanceof ToolValidationError && error.code === 'UNSUPPORTED_TOOL'
  );
});

test('validateToolRequest rejects invalid UUIDs', () => {
  assert.throws(
    () =>
      validateToolRequest({
        tool: 'get_exercise_progress',
        arguments: { exercise_id: 'not-uuid' }
      }),
    (error) => error instanceof ToolValidationError
  );
});

test('validateToolRequest rejects unknown arguments', () => {
  assert.throws(
    () =>
      validateToolRequest({
        tool: 'get_workout_summary',
        arguments: { foo: 'bar' }
      }),
    (error) => error instanceof ToolValidationError
  );
});

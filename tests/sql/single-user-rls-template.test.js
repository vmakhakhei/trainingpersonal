import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const schemaPath = new URL('../../supabase/schema.sql', import.meta.url);

test('schema.sql does not contain hardcoded single-user UUID', () => {
  const content = readFileSync(schemaPath, 'utf8');

  assert.ok(!content.includes('16a037ff-7a35-43a0-8522-1e64c6163abf'));
  assert.ok(content.includes('YOUR_SUPABASE_USER_ID'));
  assert.ok(content.includes('user_id::TEXT = \'YOUR_SUPABASE_USER_ID\''));
});

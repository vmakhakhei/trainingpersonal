import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const envExamplePath = new URL('../../.env.example', import.meta.url);

function parseEnv(content) {
  const entries = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    entries[key] = value;
  }

  return entries;
}

test('.env.example includes required variables and safe placeholders', () => {
  const content = readFileSync(envExamplePath, 'utf8');
  const env = parseEnv(content);

  const requiredKeys = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SINGLE_USER_ID',
    'VITE_AI_PROXY_URL',
    'VITE_AI_SUGGEST_URL',
    'VITE_TOOLS_API_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEEPSEEK_API_KEY'
  ];

  for (const key of requiredKeys) {
    assert.ok(env[key], `Missing ${key}`);
  }

  assert.equal(env.VITE_SINGLE_USER_ID, 'YOUR_SUPABASE_USER_ID');
  assert.equal(env.VITE_AI_PROXY_URL, 'https://your-app.vercel.app/api/ai/proxy');
  assert.equal(env.VITE_AI_SUGGEST_URL, 'https://your-app.vercel.app/api/ai/suggest');
  assert.equal(env.VITE_TOOLS_API_URL, 'https://your-app.vercel.app/api/tools');

  assert.ok(!content.includes('16a037ff-7a35-43a0-8522-1e64c6163abf'));
  assert.ok(!content.includes('aiuwlvrvcsmwlrbajksy'));
  assert.ok(!/eyJhbGciOiJIUzI1Ni/i.test(content));
});

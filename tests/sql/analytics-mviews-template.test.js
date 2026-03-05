import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const analyticsSqlPath = new URL('../../supabase/analytics_mviews.sql', import.meta.url);
const vercelConfigPath = new URL('../../vercel.json', import.meta.url);

test('analytics_mviews.sql includes required objects and no hardcoded UUID', () => {
  const content = readFileSync(analyticsSqlPath, 'utf8');

  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS analytics_refresh_log'));
  assert.ok(content.includes('CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_workout_summary_mv'));
  assert.ok(content.includes('CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_exercise_progress_mv'));
  assert.ok(content.includes('CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_muscle_volume_mv'));
  assert.ok(content.includes('CREATE OR REPLACE FUNCTION refresh_analytics_materialized_views'));
  assert.ok(content.includes('WITH NO DATA;'));
  assert.ok(!content.includes('16a037ff-7a35-43a0-8522-1e64c6163abf'));
});

test('vercel.json keeps canonical analytics route in single function form', () => {
  const config = JSON.parse(readFileSync(vercelConfigPath, 'utf8'));

  const analyticsBuild = config.builds.find((build) => build.src === 'api/analytics/index.js');
  assert.ok(analyticsBuild);
  assert.equal(analyticsBuild.use, '@vercel/node');

  const analyticsRoute = config.routes.find((route) => route.src === '/api/analytics');
  assert.ok(analyticsRoute);
  assert.equal(analyticsRoute.dest, '/api/analytics/index.js');
});

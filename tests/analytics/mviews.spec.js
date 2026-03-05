import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../supabase/analytics_mviews.sql', import.meta.url), 'utf8');

describe('analytics materialized views migration', () => {
  it('defines required materialized views with WITH NO DATA', () => {
    expect(sql).toContain('CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_workout_summary_mv');
    expect(sql).toContain('CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_exercise_progress_mv');
    expect(sql).toContain('CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_muscle_volume_mv');

    const noDataMatches = sql.match(/WITH NO DATA;/g) || [];
    expect(noDataMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('defines refresh function and refresh log table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS analytics_refresh_log');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION refresh_analytics_materialized_views');
    expect(sql).toContain('REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_workout_summary_mv');
    expect(sql).toContain('REFRESH MATERIALIZED VIEW analytics_workout_summary_mv');
  });

  it('contains no hardcoded user UUIDs', () => {
    expect(sql).not.toContain('16a037ff-7a35-43a0-8522-1e64c6163abf');
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });
});

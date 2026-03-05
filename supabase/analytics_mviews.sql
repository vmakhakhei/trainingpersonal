-- file: supabase/analytics_mviews.sql
-- Analytics materialized views for single-user app.
-- Timezone baseline: Europe/Warsaw.

CREATE TABLE IF NOT EXISTS analytics_refresh_log (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_seconds NUMERIC(12,3),
  used_concurrently BOOLEAN NOT NULL DEFAULT false,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MATERIALIZED VIEW: workout summary
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_workout_summary_mv AS
SELECT
  w.user_id,
  w.id AS workout_id,
  w.workout_date,
  COALESCE(w.total_volume_kg, 0)::NUMERIC(12,2) AS total_volume_kg,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'exercise_id', x.exercise_id,
          'exercise_name', x.exercise_name,
          'volume_kg', x.volume_kg
        )
        ORDER BY x.volume_kg DESC
      )
      FROM (
        SELECT
          s.exercise_id,
          COALESCE(e.name_ru, e.name, s.exercise_id::TEXT) AS exercise_name,
          SUM((s.weight_kg * s.reps)::NUMERIC(12,2))::NUMERIC(12,2) AS volume_kg
        FROM sets s
        LEFT JOIN exercises e ON e.id = s.exercise_id
        WHERE s.workout_id = w.id
          AND NOT s.is_deleted
          AND NOT s.is_warmup
        GROUP BY s.exercise_id, COALESCE(e.name_ru, e.name, s.exercise_id::TEXT)
        ORDER BY SUM((s.weight_kg * s.reps)::NUMERIC(12,2)) DESC
        LIMIT 3
      ) x
    ),
    '[]'::JSONB
  ) AS top_exercises
FROM workouts w
WHERE NOT w.is_deleted
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_workout_summary_mv_pk
  ON analytics_workout_summary_mv (workout_id);

CREATE INDEX IF NOT EXISTS idx_analytics_workout_summary_mv_user_date
  ON analytics_workout_summary_mv (user_id, workout_date DESC);

-- ============================================
-- MATERIALIZED VIEW: exercise progress time series
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_exercise_progress_mv AS
SELECT
  w.user_id,
  s.exercise_id,
  COALESCE(e.name_ru, e.name, s.exercise_id::TEXT) AS exercise_name,
  w.workout_date,
  COUNT(*)::INTEGER AS sets_count,
  SUM(s.reps)::INTEGER AS total_reps,
  SUM((s.weight_kg * s.reps)::NUMERIC(12,2))::NUMERIC(12,2) AS total_volume_kg,
  MAX(s.weight_kg)::NUMERIC(8,2) AS max_weight_kg,
  MAX(calculate_1rm(s.weight_kg, s.reps))::NUMERIC(10,2) AS estimated_1rm
FROM workouts w
JOIN sets s ON s.workout_id = w.id
LEFT JOIN exercises e ON e.id = s.exercise_id
WHERE NOT w.is_deleted
  AND NOT s.is_deleted
  AND NOT s.is_warmup
GROUP BY w.user_id, s.exercise_id, COALESCE(e.name_ru, e.name, s.exercise_id::TEXT), w.workout_date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_exercise_progress_mv_pk
  ON analytics_exercise_progress_mv (user_id, exercise_id, workout_date);

CREATE INDEX IF NOT EXISTS idx_analytics_exercise_progress_mv_lookup
  ON analytics_exercise_progress_mv (user_id, exercise_id, workout_date DESC);

-- ============================================
-- MATERIALIZED VIEW: muscle volume
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_muscle_volume_mv AS
SELECT
  w.user_id,
  w.workout_date,
  e.primary_muscle AS muscle,
  COUNT(*)::INTEGER AS total_sets,
  SUM((s.weight_kg * s.reps)::NUMERIC(12,2))::NUMERIC(12,2) AS total_volume_kg
FROM workouts w
JOIN sets s ON s.workout_id = w.id
JOIN exercises e ON e.id = s.exercise_id
WHERE NOT w.is_deleted
  AND NOT s.is_deleted
  AND NOT s.is_warmup
  AND NOT e.is_deleted
GROUP BY w.user_id, w.workout_date, e.primary_muscle
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_muscle_volume_mv_pk
  ON analytics_muscle_volume_mv (user_id, workout_date, muscle);

CREATE INDEX IF NOT EXISTS idx_analytics_muscle_volume_mv_lookup
  ON analytics_muscle_volume_mv (user_id, muscle, workout_date DESC);

-- ============================================
-- REFRESH FUNCTION WITH CONCURRENT FALLBACK
-- ============================================
CREATE OR REPLACE FUNCTION refresh_analytics_materialized_views(
  p_use_concurrently BOOLEAN DEFAULT true
)
RETURNS TABLE (
  ok BOOLEAN,
  duration_seconds NUMERIC,
  used_concurrently BOOLEAN,
  refreshed_at TIMESTAMPTZ,
  log_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_started_at TIMESTAMPTZ := clock_timestamp();
  v_finished_at TIMESTAMPTZ;
  v_duration_seconds NUMERIC;
  v_used_concurrently BOOLEAN := false;
  v_log_id BIGINT;
BEGIN
  INSERT INTO analytics_refresh_log (started_at, success, used_concurrently, details)
  VALUES (
    NOW(),
    false,
    false,
    jsonb_build_object('requested_concurrently', p_use_concurrently)
  )
  RETURNING id INTO v_log_id;

  BEGIN
    IF p_use_concurrently THEN
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_workout_summary_mv;
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_exercise_progress_mv;
        REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_muscle_volume_mv;
        v_used_concurrently := true;
      EXCEPTION
        WHEN feature_not_supported OR object_not_in_prerequisite_state OR invalid_parameter_value THEN
          REFRESH MATERIALIZED VIEW analytics_workout_summary_mv;
          REFRESH MATERIALIZED VIEW analytics_exercise_progress_mv;
          REFRESH MATERIALIZED VIEW analytics_muscle_volume_mv;
          v_used_concurrently := false;
      END;
    ELSE
      REFRESH MATERIALIZED VIEW analytics_workout_summary_mv;
      REFRESH MATERIALIZED VIEW analytics_exercise_progress_mv;
      REFRESH MATERIALIZED VIEW analytics_muscle_volume_mv;
      v_used_concurrently := false;
    END IF;

    v_finished_at := clock_timestamp();
    v_duration_seconds := EXTRACT(EPOCH FROM (v_finished_at - v_started_at));

    UPDATE analytics_refresh_log
    SET
      finished_at = v_finished_at,
      duration_seconds = v_duration_seconds,
      used_concurrently = v_used_concurrently,
      success = true,
      details = COALESCE(details, '{}'::JSONB) || jsonb_build_object(
        'refreshed_views', ARRAY[
          'analytics_workout_summary_mv',
          'analytics_exercise_progress_mv',
          'analytics_muscle_volume_mv'
        ]
      )
    WHERE id = v_log_id;

    RETURN QUERY SELECT true, v_duration_seconds, v_used_concurrently, NOW(), v_log_id;
  EXCEPTION
    WHEN OTHERS THEN
      v_finished_at := clock_timestamp();
      v_duration_seconds := EXTRACT(EPOCH FROM (v_finished_at - v_started_at));

      UPDATE analytics_refresh_log
      SET
        finished_at = v_finished_at,
        duration_seconds = v_duration_seconds,
        used_concurrently = v_used_concurrently,
        success = false,
        error_message = SQLERRM
      WHERE id = v_log_id;

      RETURN QUERY SELECT false, v_duration_seconds, v_used_concurrently, NOW(), v_log_id;
  END;
END;
$$;

COMMENT ON MATERIALIZED VIEW analytics_workout_summary_mv IS
  'Workout-level summary with top_exercises payload for API read endpoints.';

COMMENT ON MATERIALIZED VIEW analytics_exercise_progress_mv IS
  'Exercise progress time series aggregated by workout_date.';

COMMENT ON MATERIALIZED VIEW analytics_muscle_volume_mv IS
  'Muscle-group daily volume aggregates.';

COMMENT ON FUNCTION refresh_analytics_materialized_views(BOOLEAN) IS
  'Refreshes analytics materialized views with concurrent fallback and refresh logging.';

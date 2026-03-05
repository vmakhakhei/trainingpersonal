import crypto from 'node:crypto';
import { getUserId, handleOptions } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabase.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_MUSCLES = new Set(['chest', 'back', 'legs', 'shoulders', 'arms', 'core']);

class AnalyticsError extends Error {
  constructor(message, code = 'ANALYTICS_ERROR', statusCode = 400) {
    super(message);
    this.name = 'AnalyticsError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function getQueryValue(query = {}, key) {
  const value = query[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseLimit(value, defaultValue, maxValue = 100) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > maxValue) {
    throw new AnalyticsError(`Query param "limit" must be an integer in range 1..${maxValue}`, 'BAD_ARGS', 400);
  }

  return numeric;
}

function parseIsoDate(value, key) {
  if (!value) {
    return null;
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AnalyticsError(`Query param "${key}" must be in format YYYY-MM-DD`, 'BAD_ARGS', 400);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AnalyticsError(`Query param "${key}" is not a valid date`, 'BAD_ARGS', 400);
  }

  return value;
}

function parseWorkoutSummaryArgs(query) {
  return {
    limit: parseLimit(getQueryValue(query, 'limit'), 5, 50)
  };
}

function parseExerciseProgressArgs(query) {
  const exerciseId = getQueryValue(query, 'exercise_id');
  if (!exerciseId || typeof exerciseId !== 'string' || !UUID_REGEX.test(exerciseId)) {
    throw new AnalyticsError('Query param "exercise_id" must be a valid UUID', 'BAD_ARGS', 400);
  }

  return {
    exerciseId,
    limit: parseLimit(getQueryValue(query, 'limit'), 20, 50)
  };
}

function parseMuscleVolumeArgs(query) {
  const from = parseIsoDate(getQueryValue(query, 'from'), 'from');
  const to = parseIsoDate(getQueryValue(query, 'to'), 'to');
  const muscle = getQueryValue(query, 'muscle');

  if (from && to && from > to) {
    throw new AnalyticsError('Query param "from" must be <= "to"', 'BAD_ARGS', 400);
  }

  if (muscle && (!ALLOWED_MUSCLES.has(String(muscle).toLowerCase()))) {
    throw new AnalyticsError(
      `Query param "muscle" must be one of: ${Array.from(ALLOWED_MUSCLES).join(', ')}`,
      'BAD_ARGS',
      400
    );
  }

  return {
    from,
    to,
    muscle: muscle ? String(muscle).toLowerCase() : null
  };
}

function mapError(error) {
  if (error instanceof AnalyticsError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    };
  }

  if (typeof error?.statusCode === 'number' && typeof error?.code === 'string') {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message || 'Request failed'
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: error?.message || 'Internal server error'
  };
}

function secretsMatch(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') {
    return false;
  }

  const a = Buffer.from(actual);
  const b = Buffer.from(expected);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

async function queryWorkoutSummary({ userId, args, supabaseClient }) {
  const { data, error } = await supabaseClient
    .from('analytics_workout_summary_mv')
    .select('workout_id, workout_date, total_volume_kg, top_exercises')
    .eq('user_id', userId)
    .order('workout_date', { ascending: false })
    .limit(args.limit);

  if (error) {
    throw error;
  }

  return data || [];
}

async function queryExerciseProgress({ userId, args, supabaseClient }) {
  const { data, error } = await supabaseClient
    .from('analytics_exercise_progress_mv')
    .select(
      'exercise_id, exercise_name, workout_date, total_volume_kg, total_reps, sets_count, max_weight_kg, estimated_1rm'
    )
    .eq('user_id', userId)
    .eq('exercise_id', args.exerciseId)
    .order('workout_date', { ascending: false })
    .limit(args.limit);

  if (error) {
    throw error;
  }

  return data || [];
}

async function queryMuscleVolume({ userId, args, supabaseClient }) {
  let query = supabaseClient
    .from('analytics_muscle_volume_mv')
    .select('workout_date, muscle, total_sets, total_volume_kg')
    .eq('user_id', userId)
    .order('workout_date', { ascending: false });

  if (args.from) {
    query = query.gte('workout_date', args.from);
  }

  if (args.to) {
    query = query.lte('workout_date', args.to);
  }

  if (args.muscle) {
    query = query.eq('muscle', args.muscle);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

export async function executeReadOperation({ op, query, userId, supabaseClient = supabaseAdmin }) {
  switch (op) {
    case 'workout_summary': {
      const args = parseWorkoutSummaryArgs(query);
      return queryWorkoutSummary({ userId, args, supabaseClient });
    }
    case 'exercise_progress': {
      const args = parseExerciseProgressArgs(query);
      return queryExerciseProgress({ userId, args, supabaseClient });
    }
    case 'muscle_volume': {
      const args = parseMuscleVolumeArgs(query);
      return queryMuscleVolume({ userId, args, supabaseClient });
    }
    default:
      throw new AnalyticsError(
        'Unsupported op. Use one of: workout_summary, exercise_progress, muscle_volume',
        'BAD_ARGS',
        400
      );
  }
}

function normalizeRefreshResult(data) {
  const firstRow = Array.isArray(data) ? data[0] : data;

  if (!firstRow || typeof firstRow !== 'object') {
    throw new AnalyticsError('Unexpected refresh RPC response', 'REFRESH_FAILED', 500);
  }

  return {
    ok: Boolean(firstRow.ok),
    duration_seconds: Number(firstRow.duration_seconds) || 0,
    used_concurrently: Boolean(firstRow.used_concurrently),
    refreshed_at: firstRow.refreshed_at || null,
    log_id: firstRow.log_id ?? null
  };
}

export async function executeRefreshOperation({
  req,
  query,
  supabaseClient = supabaseAdmin,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
}) {
  const op = getQueryValue(query, 'op');

  if (op !== 'refresh') {
    throw new AnalyticsError('POST supports only op=refresh', 'BAD_ARGS', 400);
  }

  if (!serviceRoleKey) {
    throw new AnalyticsError('SUPABASE_SERVICE_ROLE_KEY is not configured', 'INTERNAL_ERROR', 500);
  }

  const headerSecret = req.headers?.['x-service-role'];
  if (!secretsMatch(headerSecret, serviceRoleKey)) {
    throw new AnalyticsError('Unauthorized refresh request', 'UNAUTHORIZED', 401);
  }

  const useConcurrently = req.body?.use_concurrently !== false;

  const { data, error } = await supabaseClient.rpc('refresh_analytics_materialized_views', {
    p_use_concurrently: useConcurrently
  });

  if (error) {
    throw new AnalyticsError(error.message || 'Refresh failed', 'REFRESH_FAILED', 500);
  }

  const result = normalizeRefreshResult(data);

  if (!result.ok) {
    throw new AnalyticsError('Refresh function returned failure', 'REFRESH_FAILED', 500);
  }

  return result;
}

export function createAnalyticsHandler(overrides = {}) {
  const deps = {
    getUserId,
    executeReadOperation,
    executeRefreshOperation,
    ...overrides
  };

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-service-role');

    if (req.method === 'OPTIONS') {
      return handleOptions(res);
    }

    try {
      if (req.method === 'GET') {
        const userId = deps.getUserId(req);
        const op = getQueryValue(req.query, 'op');

        const data = await deps.executeReadOperation({
          op,
          query: req.query,
          userId
        });

        return res.status(200).json({
          success: true,
          data
        });
      }

      if (req.method === 'POST') {
        const result = await deps.executeRefreshOperation({
          req,
          query: req.query
        });

        return res.status(200).json({
          success: true,
          result: {
            ok: result.ok,
            duration_seconds: result.duration_seconds,
            used_concurrently: result.used_concurrently,
            refreshed_at: result.refreshed_at
          },
          log_id: result.log_id
        });
      }

      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      });
    } catch (error) {
      const mapped = mapError(error);
      return res.status(mapped.statusCode).json({
        success: false,
        error: mapped.message,
        code: mapped.code
      });
    }
  };
}

const handler = createAnalyticsHandler();

export default handler;

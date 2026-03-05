import crypto from 'crypto';
import { supabaseAdmin } from '../_lib/supabase.js';
import { getUserId, handleOptions } from '../_lib/auth.js';

const SUPPORTED_PROMPT_TYPES = new Set(['autofill_set', 'session_summary']);
const MUSCLE_LABELS_RU = {
  chest: 'грудь',
  back: 'спину',
  legs: 'ноги',
  shoulders: 'плечи',
  arms: 'руки',
  core: 'кор'
};

class SuggestError extends Error {
  constructor(message, code = 'SUGGEST_ERROR', statusCode = 500) {
    super(message);
    this.name = 'SuggestError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeWeight(value) {
  const numberValue = toNumber(value);
  if (numberValue === null) return null;
  return Math.round(numberValue * 100) / 100;
}

function normalizeSet(row = {}) {
  const weight = normalizeWeight(row.weight_kg);
  const reps = toNumber(row.reps);

  if (weight === null || reps === null) {
    return null;
  }

  return {
    weight_kg: weight,
    reps: Math.max(1, Math.round(reps)),
    rpe: toNumber(row.rpe)
  };
}

function buildAutofillSuggestion(lastSet) {
  const payload = {
    weight_kg: lastSet.weight_kg,
    reps: lastSet.reps,
    rpe: lastSet.rpe
  };

  return {
    id: 's1',
    type: 'autofill',
    payload,
    confidence: 0.9,
    explain: `последний подход был ${lastSet.weight_kg}×${lastSet.reps}`,
    sources: []
  };
}

function countBy(items, selector) {
  const map = new Map();

  for (const item of items) {
    const key = selector(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }

  return map;
}

function findTopKey(map) {
  let topKey = null;
  let topValue = -1;

  for (const [key, value] of map.entries()) {
    if (value > topValue) {
      topKey = key;
      topValue = value;
    }
  }

  return topKey;
}

export function buildSessionSummaryPayload(workoutSets = []) {
  if (!Array.isArray(workoutSets) || workoutSets.length === 0) {
    return {
      summary: 'Тренировка завершена. Добавьте больше подходов для детального AI-разбора.',
      highlights: ['Нет данных по подходам в этой тренировке'],
      suggestions: ['Сделайте хотя бы 3 рабочих подхода в следующей тренировке']
    };
  }

  const totalSets = workoutSets.length;
  const totalVolume = workoutSets.reduce((acc, set) => {
    const weight = toNumber(set.weight_kg) || 0;
    const reps = toNumber(set.reps) || 0;
    return acc + weight * reps;
  }, 0);

  const avgRpe = workoutSets.reduce((acc, set) => acc + (toNumber(set.rpe) || 0), 0) / totalSets;
  const topExerciseMap = countBy(workoutSets, (set) => set.exercises?.name_ru || set.exercise_id);
  const topMuscleMap = countBy(workoutSets, (set) => set.exercises?.primary_muscle || null);

  const topExercise = findTopKey(topExerciseMap);
  const topMuscle = findTopKey(topMuscleMap);
  const muscleLabel = MUSCLE_LABELS_RU[topMuscle] || 'целевые группы мышц';

  const summary = topMuscle
    ? `Сегодня хороший объём на ${muscleLabel}`
    : 'Сегодня получился хороший тренировочный объём';

  const highlights = [
    `Подходов: ${totalSets}`,
    `Общий объём: ${Math.round(totalVolume)} кг`
  ];

  if (topExercise) {
    highlights.push(`Топ упражнение: ${topExercise}`);
  }

  const suggestions = [];

  if (avgRpe >= 9) {
    suggestions.push('Следующую тренировку начните с -2.5% веса для стабильной техники');
  } else if (avgRpe > 0 && avgRpe <= 7) {
    suggestions.push('Можно добавить 1-2 повторения в последнем рабочем подходе');
  }

  if (totalSets < 6) {
    suggestions.push('Добавьте 1-2 подхода, чтобы повысить общий тренировочный объём');
  }

  if (suggestions.length === 0) {
    suggestions.push('Сохраните текущую прогрессию и контролируйте RPE в диапазоне 7-9');
  }

  return {
    summary,
    highlights,
    suggestions
  };
}

export async function getRecentSetsForExercise({ supabaseClient, userId, exerciseId, limit = 10 }) {
  const { data, error } = await supabaseClient
    .from('sets')
    .select('id, workout_id, exercise_id, set_order, weight_kg, reps, rpe, created_at, workouts!inner(user_id, is_deleted)')
    .eq('exercise_id', exerciseId)
    .eq('is_deleted', false)
    .eq('workouts.user_id', userId)
    .eq('workouts.is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function getWorkoutSets({ supabaseClient, userId, workoutId }) {
  const { data: workout, error: workoutError } = await supabaseClient
    .from('workouts')
    .select('id, user_id')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .single();

  if (workoutError || !workout) {
    throw new SuggestError('Workout not found', 'WORKOUT_NOT_FOUND', 404);
  }

  const { data: sets, error: setsError } = await supabaseClient
    .from('sets')
    .select('id, workout_id, exercise_id, set_order, weight_kg, reps, rpe, exercises(name_ru, primary_muscle)')
    .eq('workout_id', workoutId)
    .eq('is_deleted', false)
    .order('set_order', { ascending: true });

  if (setsError) {
    throw setsError;
  }

  return Array.isArray(sets) ? sets : [];
}

export async function logSuggestRequest({ userId, requestPayload, responsePayload, statusCode, errorMessage }) {
  await supabaseAdmin.from('ai_requests').insert({
    user_id: userId || null,
    endpoint: '/api/ai/suggest',
    prompt_text: requestPayload ? requestPayload.slice(0, 500) : null,
    response_text: responsePayload ? responsePayload.slice(0, 1000) : null,
    status_code: statusCode,
    error_message: errorMessage || null
  });
}

function mapSuggestError(error) {
  if (error instanceof SuggestError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: error?.message || 'Internal server error'
  };
}

export function createAiSuggestHandler(overrides = {}) {
  const deps = {
    getUserId,
    getRecentSetsForExercise,
    getWorkoutSets,
    logSuggestRequest,
    now: () => Date.now(),
    randomUUID: () => crypto.randomUUID(),
    supabaseClient: supabaseAdmin,
    ...overrides
  };

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return handleOptions(res);
    }

    const startedAt = deps.now();
    const traceId = deps.randomUUID();
    let userId = null;
    let requestPayload = null;

    try {
      if (req.method !== 'POST') {
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        });
      }

      const body = req.body || {};
      const context = body.context && typeof body.context === 'object' ? body.context : {};

      if (!SUPPORTED_PROMPT_TYPES.has(body.prompt_type)) {
        throw new SuggestError(
          'Field "prompt_type" must be one of: autofill_set, session_summary',
          'INVALID_ARGUMENTS',
          400
        );
      }

      userId = deps.getUserId(req);
      requestPayload = JSON.stringify(body);

      let suggestions = [];

      if (body.prompt_type === 'autofill_set') {
        if (typeof context.exercise_id !== 'string' || !context.exercise_id.trim()) {
          throw new SuggestError('context.exercise_id is required', 'INVALID_ARGUMENTS', 400);
        }

        const recentSets = await deps.getRecentSetsForExercise({
          supabaseClient: deps.supabaseClient,
          userId,
          exerciseId: context.exercise_id
        });

        const recentSet = normalizeSet(recentSets[0]);
        const fallbackRecentSets = Array.isArray(context.recent_sets) ? context.recent_sets : [];
        const fallbackSet = normalizeSet(fallbackRecentSets[fallbackRecentSets.length - 1]);
        const lastSet = recentSet || fallbackSet;

        if (lastSet) {
          suggestions = [buildAutofillSuggestion(lastSet)];
        }
      }

      if (body.prompt_type === 'session_summary') {
        if (typeof context.workout_id !== 'string' || !context.workout_id.trim()) {
          throw new SuggestError('context.workout_id is required', 'INVALID_ARGUMENTS', 400);
        }

        const workoutSets = await deps.getWorkoutSets({
          supabaseClient: deps.supabaseClient,
          userId,
          workoutId: context.workout_id
        });

        suggestions = [
          {
            id: 's1',
            type: 'session_summary',
            payload: buildSessionSummaryPayload(workoutSets),
            confidence: 0.8,
            explain: 'summary generated from workout volume, exercise mix and RPE',
            sources: []
          }
        ];
      }

      const responsePayload = {
        success: true,
        trace_id: traceId,
        prompt_type: body.prompt_type,
        suggestions,
        cached: false
      };

      await deps
        .logSuggestRequest({
          userId,
          requestPayload,
          responsePayload: JSON.stringify(responsePayload),
          statusCode: 200,
          errorMessage: null,
          latencyMs: deps.now() - startedAt
        })
        .catch(() => {});

      return res.status(200).json(responsePayload);
    } catch (error) {
      const mapped = mapSuggestError(error);

      await deps
        .logSuggestRequest({
          userId,
          requestPayload,
          responsePayload: null,
          statusCode: mapped.statusCode,
          errorMessage: mapped.message,
          latencyMs: deps.now() - startedAt
        })
        .catch(() => {});

      return res.status(mapped.statusCode).json({
        success: false,
        trace_id: traceId,
        error: mapped.message,
        code: mapped.code
      });
    }
  };
}

const handler = createAiSuggestHandler();

export default handler;

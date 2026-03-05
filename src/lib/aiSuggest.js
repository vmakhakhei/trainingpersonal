const DEFAULT_AI_SUGGEST_ENDPOINT = '/api/ai/suggest';

function getRuntimeEnv() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env;
  }

  return {};
}

export function getAiSuggestEndpoint() {
  const env = getRuntimeEnv();
  const configuredUrl =
    typeof env.VITE_AI_SUGGEST_URL === 'string' ? env.VITE_AI_SUGGEST_URL.trim() : '';

  return configuredUrl || DEFAULT_AI_SUGGEST_ENDPOINT;
}

function isLikelyLocalApiPath(url) {
  return typeof url === 'string' && url.startsWith('/api/');
}

function shouldUseLocalHeuristicOnly(endpoint) {
  const env = getRuntimeEnv();
  return Boolean(env.DEV) && isLikelyLocalApiPath(endpoint);
}

function normalizeSuggestions(data) {
  if (!data || !Array.isArray(data.suggestions)) {
    return [];
  }

  return data.suggestions;
}

export function findSuggestionByType(suggestions, type) {
  if (!Array.isArray(suggestions)) {
    return null;
  }

  return suggestions.find((item) => item?.type === type) || null;
}

function normalizeSet(set) {
  if (!set || typeof set !== 'object') {
    return null;
  }

  const weight = Number(set.weight_kg);
  const reps = Number(set.reps);

  if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps < 1) {
    return null;
  }

  const rpe = Number(set.rpe);

  return {
    weight_kg: Math.round(weight * 100) / 100,
    reps: Math.round(reps),
    rpe: Number.isFinite(rpe) ? Math.round(rpe * 10) / 10 : null
  };
}

function buildLocalAutofillSuggestion(recentSets = []) {
  const normalized = Array.isArray(recentSets)
    ? recentSets
      .map((item) => normalizeSet(item))
      .filter(Boolean)
    : [];

  if (normalized.length === 0) {
    return null;
  }

  const lastSet = normalized[normalized.length - 1];

  return {
    id: 'local-autofill',
    type: 'autofill',
    payload: {
      weight_kg: lastSet.weight_kg,
      reps: lastSet.reps,
      rpe: lastSet.rpe
    },
    confidence: 0.85,
    explain: `локально: последний подход ${lastSet.weight_kg}×${lastSet.reps}`,
    sources: []
  };
}

function buildLocalSessionSummary(recentSets = []) {
  const normalized = Array.isArray(recentSets)
    ? recentSets
      .map((item) => normalizeSet(item))
      .filter(Boolean)
    : [];

  if (normalized.length === 0) {
    return {
      summary: 'Тренировка завершена',
      highlights: ['Подходов: 0'],
      suggestions: ['Добавьте рабочие подходы, чтобы получить более точный AI summary']
    };
  }

  const totalSets = normalized.length;
  const volume = normalized.reduce((acc, set) => acc + set.weight_kg * set.reps, 0);
  const avgRpe =
    normalized.reduce((acc, set) => acc + (Number.isFinite(set.rpe) ? set.rpe : 0), 0) /
    totalSets;

  const suggestions = [];

  if (avgRpe >= 9) {
    suggestions.push('Следующую тренировку начните с -2.5% веса для сохранения техники');
  } else if (avgRpe > 0 && avgRpe <= 7) {
    suggestions.push('Можно добавить 1 повторение в последнем рабочем подходе');
  }

  if (suggestions.length === 0) {
    suggestions.push('Сохраняйте рабочий диапазон RPE 7-9 для стабильной прогрессии');
  }

  return {
    summary: 'Тренировка завершена, прогресс сохранён',
    highlights: [`Подходов: ${totalSets}`, `Общий объём: ${Math.round(volume)} кг`],
    suggestions
  };
}

export async function parseAiSuggestResponse(response, endpoint = DEFAULT_AI_SUGGEST_ENDPOINT) {
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    if (isLikelyLocalApiPath(endpoint)) {
      throw new Error(
        'AI Suggest API вернул пустой ответ. В Vite dev /api/* не исполняется. Укажите VITE_AI_SUGGEST_URL или используйте vercel dev.'
      );
    }

    throw new Error('AI Suggest API вернул пустой ответ');
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    if (isLikelyLocalApiPath(endpoint) && !contentType.includes('application/json')) {
      throw new Error(
        'AI Suggest API вернул не-JSON ответ. В Vite dev /api/* не исполняется. Укажите VITE_AI_SUGGEST_URL или используйте vercel dev.'
      );
    }

    throw new Error('AI Suggest API вернул некорректный JSON');
  }
}

export async function requestAiSuggest({
  promptType,
  context = {},
  fetchImpl = fetch,
  endpoint
}) {
  const targetEndpoint = endpoint || getAiSuggestEndpoint();

  const response = await fetchImpl(targetEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt_type: promptType,
      context
    })
  });

  const payload = await parseAiSuggestResponse(response, targetEndpoint);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'AI suggest request failed');
  }

  return payload;
}

export async function requestAutofillSuggestion({
  exerciseId,
  workoutId,
  recentSets = [],
  fetchImpl = fetch,
  endpoint
}) {
  const localFallback = buildLocalAutofillSuggestion(recentSets);
  const targetEndpoint = endpoint || getAiSuggestEndpoint();

  if (shouldUseLocalHeuristicOnly(targetEndpoint)) {
    return localFallback;
  }

  try {
    const payload = await requestAiSuggest({
      promptType: 'autofill_set',
      context: {
        exercise_id: exerciseId,
        workout_id: workoutId,
        recent_sets: recentSets
      },
      fetchImpl,
      endpoint: targetEndpoint
    });

    return findSuggestionByType(normalizeSuggestions(payload), 'autofill') || localFallback;
  } catch {
    return localFallback;
  }
}

export async function requestSessionSummary({
  workoutId,
  recentSets = [],
  fetchImpl = fetch,
  endpoint
}) {
  const localFallback = buildLocalSessionSummary(recentSets);
  const targetEndpoint = endpoint || getAiSuggestEndpoint();

  if (shouldUseLocalHeuristicOnly(targetEndpoint)) {
    return localFallback;
  }

  try {
    const payload = await requestAiSuggest({
      promptType: 'session_summary',
      context: {
        workout_id: workoutId,
        recent_sets: recentSets
      },
      fetchImpl,
      endpoint: targetEndpoint
    });

    const summarySuggestion = findSuggestionByType(normalizeSuggestions(payload), 'session_summary');

    if (!summarySuggestion?.payload) {
      return localFallback;
    }

    return summarySuggestion.payload;
  } catch {
    return localFallback;
  }
}

export function formatWeightValue(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return '';
  }

  const rounded = Math.round(parsed * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function applyWeightChange({ currentWeight, fallbackWeight, multiplier }) {
  const base = Number(currentWeight);

  if (Number.isFinite(base) && base > 0) {
    return formatWeightValue(base * multiplier);
  }

  const fallback = Number(fallbackWeight);
  if (Number.isFinite(fallback) && fallback > 0) {
    return formatWeightValue(fallback * multiplier);
  }

  return '';
}

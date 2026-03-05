const AI_SUGGEST_ENDPOINT = '/api/ai/suggest';

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

export async function requestAiSuggest({ promptType, context = {}, fetchImpl = fetch }) {
  const response = await fetchImpl(AI_SUGGEST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt_type: promptType,
      context
    })
  });

  const payload = await response.json();

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'AI suggest request failed');
  }

  return payload;
}

export async function requestAutofillSuggestion({ exerciseId, workoutId, recentSets = [], fetchImpl = fetch }) {
  const payload = await requestAiSuggest({
    promptType: 'autofill_set',
    context: {
      exercise_id: exerciseId,
      workout_id: workoutId,
      recent_sets: recentSets
    },
    fetchImpl
  });

  return findSuggestionByType(normalizeSuggestions(payload), 'autofill');
}

export async function requestSessionSummary({ workoutId, fetchImpl = fetch }) {
  const payload = await requestAiSuggest({
    promptType: 'session_summary',
    context: {
      workout_id: workoutId
    },
    fetchImpl
  });

  const summarySuggestion = findSuggestionByType(normalizeSuggestions(payload), 'session_summary');

  if (!summarySuggestion?.payload) {
    return {
      summary: 'Тренировка завершена',
      highlights: [],
      suggestions: []
    };
  }

  return summarySuggestion.payload;
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

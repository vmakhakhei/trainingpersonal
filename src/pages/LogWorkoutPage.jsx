import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, X, Dumbbell } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import SuggestionPill from '../components/AI/SuggestionPill';
import {
  applyWeightChange,
  formatWeightValue,
  requestAutofillSuggestion,
  requestSessionSummary
} from '../lib/aiSuggest';
import { callToolsApi } from '../lib/toolsClient';

function parseNumberInput(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).replace(',', '.').trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function LogWorkoutPage() {
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [sets, setSets] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finishingWorkout, setFinishingWorkout] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [autofillSuggestion, setAutofillSuggestion] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);

  // Источник: ux_guidelines - минимизация кликов (≤3 для добавления подхода)
  const [quickSet, setQuickSet] = useState({
    weight_kg: '',
    reps: '',
    rpe: ''
  });

  const selectedExerciseSets = useMemo(() => {
    if (!selectedExercise?.id) {
      return [];
    }

    return sets.filter((set) => set.exercise_id === selectedExercise.id);
  }, [sets, selectedExercise?.id]);

  const lastExerciseSet = selectedExerciseSets.length > 0
    ? selectedExerciseSets[selectedExerciseSets.length - 1]
    : null;

  const canChangeWeight =
    parseNumberInput(quickSet.weight_kg) !== null ||
    parseNumberInput(lastExerciseSet?.weight_kg) !== null ||
    parseNumberInput(autofillSuggestion?.payload?.weight_kg) !== null;

  useEffect(() => {
    loadExercises();
    createWorkout();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAutofillSuggestion() {
      if (!selectedExercise?.id || !workout?.id) {
        setAutofillSuggestion(null);
        return;
      }

      try {
        setLoadingSuggestion(true);

        const recentSets = sets
          .filter((set) => set.exercise_id === selectedExercise.id)
          .slice(-3)
          .map((set) => ({
            weight_kg: set.weight_kg,
            reps: set.reps,
            rpe: set.rpe
          }));

        const suggestion = await requestAutofillSuggestion({
          exerciseId: selectedExercise.id,
          workoutId: workout.id,
          recentSets
        });

        if (!cancelled) {
          setAutofillSuggestion(suggestion);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Autofill suggestion error:', error);
          setAutofillSuggestion(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestion(false);
        }
      }
    }

    loadAutofillSuggestion();

    return () => {
      cancelled = true;
    };
  }, [selectedExercise?.id, workout?.id, sets]);

  async function loadExercises() {
    // Источник: core_features.exercise_library
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('is_deleted', false)
      .order('name_ru');

    if (!error && data) {
      setExercises(data);
    }
  }

  async function createWorkout() {
    try {
      setLoading(true);
      // Источник: core_features.log_workout
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: SINGLE_USER_ID,
          workout_date: new Date().toISOString().split('T')[0],
          start_time: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setWorkout(data);
    } catch (error) {
      console.error('Error creating workout:', error);
      alert('Ошибка создания тренировки');
    } finally {
      setLoading(false);
    }
  }

  function applySetToQuickForm(payload) {
    if (!payload) {
      return;
    }

    setQuickSet((prev) => ({
      ...prev,
      weight_kg:
        payload.weight_kg === null || payload.weight_kg === undefined
          ? prev.weight_kg
          : formatWeightValue(payload.weight_kg),
      reps:
        payload.reps === null || payload.reps === undefined
          ? prev.reps
          : String(payload.reps),
      rpe:
        payload.rpe === null || payload.rpe === undefined
          ? ''
          : String(payload.rpe)
    }));
  }

  function repeatLastSet() {
    if (!lastExerciseSet) {
      return;
    }

    applySetToQuickForm(lastExerciseSet);
  }

  function adjustWeight(multiplier) {
    const nextWeight = applyWeightChange({
      currentWeight: quickSet.weight_kg,
      fallbackWeight: lastExerciseSet?.weight_kg ?? autofillSuggestion?.payload?.weight_kg,
      multiplier
    });

    if (!nextWeight) {
      return;
    }

    setQuickSet((prev) => ({
      ...prev,
      weight_kg: nextWeight
    }));
  }

  async function addSet() {
    if (!selectedExercise || !quickSet.weight_kg || !quickSet.reps) {
      alert('Заполните вес и повторения');
      return;
    }

    try {
      // Источник: CONSTRAINTS - reps>=1, weight>=0
      const weight = parseNumberInput(quickSet.weight_kg);
      const reps = parseInt(quickSet.reps, 10);
      const parsedRpe = parseNumberInput(quickSet.rpe);
      const rpe = parsedRpe !== null && parsedRpe > 0 ? parsedRpe : null;

      if (weight === null || weight < 0 || reps < 1) {
        alert('Вес ≥0, повторения ≥1');
        return;
      }

      if (rpe !== null && (rpe < 1 || rpe > 10)) {
        alert('RPE должен быть от 1 до 10');
        return;
      }

      const nextOrder = selectedExerciseSets.length + 1;

      const { data, error } = await supabase
        .from('sets')
        .insert({
          workout_id: workout.id,
          exercise_id: selectedExercise.id,
          set_order: nextOrder,
          weight_kg: weight,
          reps,
          rpe
        })
        .select('*, exercises(name_ru, primary_muscle)')
        .single();

      if (error) throw error;

      setSets((prev) => [...prev, data]);
      setAutofillSuggestion({
        id: 's-local',
        type: 'autofill',
        payload: {
          weight_kg: data.weight_kg,
          reps: data.reps,
          rpe: data.rpe
        },
        confidence: 0.9,
        explain: `последний подход был ${data.weight_kg}×${data.reps}`,
        sources: []
      });
      setQuickSet((prev) => ({ ...prev, reps: '' }));
    } catch (error) {
      console.error('Error adding set:', error);
      alert('Ошибка добавления подхода');
    }
  }

  function fallbackSessionSummary() {
    return {
      summary: 'Тренировка завершена',
      highlights: [`Подходов: ${sets.length}`],
      suggestions: ['Продолжайте фиксировать рабочие подходы для более точных рекомендаций']
    };
  }

  async function finishWorkout() {
    if (!workout?.id || finishingWorkout) {
      return;
    }

    try {
      setFinishingWorkout(true);

      const { error } = await supabase
        .from('workouts')
        .update({ end_time: new Date().toISOString() })
        .eq('id', workout.id);

      if (error) {
        throw error;
      }

      try {
        const summary = await requestSessionSummary({
          workoutId: workout.id,
          recentSets: sets.map((set) => ({
            weight_kg: set.weight_kg,
            reps: set.reps,
            rpe: set.rpe
          }))
        });
        setSessionSummary(summary);
      } catch (summaryError) {
        console.error('Session summary error:', summaryError);
        setSessionSummary(fallbackSessionSummary());
      }

      setShowSummaryModal(true);
    } catch (error) {
      console.error('Error finishing workout:', error);
      alert('Ошибка завершения тренировки');
    } finally {
      setFinishingWorkout(false);
    }
  }

  async function generateTrainingPlan() {
    if (creatingPlan) {
      return;
    }

    const planArguments = {
      name: `AI План ${new Date().toLocaleDateString('ru-RU')}`,
      description:
        sessionSummary?.summary ||
        'План создан на основе завершенной тренировки и AI session summary',
      goal: 'strength',
      days_per_week: 3,
      duration_weeks: 8
    };

    try {
      setCreatingPlan(true);

      const toolsApiUrl = import.meta.env.VITE_TOOLS_API_URL || '/api/tools';
      const shouldUseLocalFallback = import.meta.env.DEV && toolsApiUrl.startsWith('/api/');

      if (!shouldUseLocalFallback) {
        await callToolsApi({
          tool: 'createTrainingPlan',
          arguments: planArguments,
          endpoint: toolsApiUrl
        });
      } else {
        const { error: fallbackError } = await supabase
          .from('workout_plans')
          .insert({
            user_id: SINGLE_USER_ID,
            name: planArguments.name,
            description: planArguments.description,
            goal: planArguments.goal,
            days_per_week: planArguments.days_per_week,
            duration_weeks: planArguments.duration_weeks
          })
          .select('id')
          .single();

        if (fallbackError) {
          throw fallbackError;
        }
      }

      alert('План успешно создан');
    } catch (error) {
      console.error('Create plan error:', error);
      alert(`Ошибка создания плана: ${error.message}`);
    } finally {
      setCreatingPlan(false);
    }
  }

  function goToWorkoutDetails() {
    setShowSummaryModal(false);
    navigate(`/workouts/${workout.id}`);
  }

  if (loading || !workout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dark-muted">Создание тренировки...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <div className="bg-dark-surface border-b border-dark-border p-4 safe-top">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Новая тренировка</h1>
          <button
            onClick={finishWorkout}
            disabled={finishingWorkout}
            className="btn-primary flex items-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>{finishingWorkout ? 'Завершение...' : 'Завершить'}</span>
          </button>
        </div>
      </div>

      {/* Exercise Selection */}
      {!selectedExercise ? (
        <div className="p-4">
          <button
            onClick={() => setShowExercisePicker(true)}
            className="w-full card-elevated py-8 text-center"
          >
            <Plus className="w-12 h-12 mx-auto text-primary-500 mb-3" />
            <p className="font-medium">Выберите упражнение</p>
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Selected Exercise */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Dumbbell className="w-6 h-6 text-primary-500" />
                <div>
                  <div className="font-semibold">{selectedExercise.name_ru}</div>
                  <div className="text-sm text-dark-muted">{selectedExercise.primary_muscle}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedExercise(null)}
                className="p-2 hover:bg-dark-elevated rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Set Input */}
          <div className="card">
            <div className="text-sm font-medium mb-3">Быстрое добавление подхода</div>

            <div className="space-y-2 mb-3">
              {loadingSuggestion && (
                <div className="text-xs text-dark-muted">AI подбирает smart autofill...</div>
              )}

              {!loadingSuggestion && autofillSuggestion && (
                <SuggestionPill suggestion={autofillSuggestion} onApply={applySetToQuickForm} />
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={repeatLastSet}
                disabled={!lastExerciseSet}
                className="btn-secondary text-sm px-3 py-2"
              >
                Повторить
              </button>
              <button
                type="button"
                onClick={() => adjustWeight(1.05)}
                disabled={!canChangeWeight}
                className="btn-secondary text-sm px-3 py-2"
              >
                +5%
              </button>
              <button
                type="button"
                onClick={() => adjustWeight(0.95)}
                disabled={!canChangeWeight}
                className="btn-secondary text-sm px-3 py-2"
              >
                -5%
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-dark-muted">Вес (кг)</label>
                <input
                  type="number"
                  value={quickSet.weight_kg}
                  onChange={(e) => setQuickSet({ ...quickSet, weight_kg: e.target.value })}
                  className="input-field w-full mt-1"
                  placeholder="100"
                  step="0.5"
                  min="0"
                />
              </div>
              <div>
                <label className="text-xs text-dark-muted">Повторения</label>
                <input
                  type="number"
                  value={quickSet.reps}
                  onChange={(e) => setQuickSet({ ...quickSet, reps: e.target.value })}
                  className="input-field w-full mt-1"
                  placeholder="10"
                  min="1"
                />
              </div>
              <div>
                <label className="text-xs text-dark-muted">RPE</label>
                <input
                  type="number"
                  value={quickSet.rpe}
                  onChange={(e) => setQuickSet({ ...quickSet, rpe: e.target.value })}
                  className="input-field w-full mt-1"
                  placeholder="опц."
                  min="0"
                  max="10"
                  step="0.5"
                />
              </div>
            </div>
            <button onClick={addSet} className="btn-primary w-full">
              <Plus className="w-5 h-5 inline mr-2" />
              Добавить подход
            </button>
          </div>

          {/* Sets List */}
          <div className="space-y-2">
            {selectedExerciseSets.map((set, idx) => (
              <div key={set.id} className="card flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-dark-muted font-mono">#{idx + 1}</div>
                  <div>
                    <div className="font-semibold">{set.weight_kg} кг × {set.reps}</div>
                    {set.rpe && <div className="text-sm text-dark-muted">RPE: {set.rpe}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-lg sm:rounded-xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h2 className="font-semibold">Выбрать упражнение</h2>
              <button onClick={() => setShowExercisePicker(false)} className="p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
              {exercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => {
                    setSelectedExercise(exercise);
                    setAutofillSuggestion(null);
                    setShowExercisePicker(false);
                  }}
                  className="w-full card hover:bg-dark-elevated transition-colors text-left"
                >
                  <div className="font-medium">{exercise.name_ru}</div>
                  <div className="text-sm text-dark-muted">{exercise.primary_muscle}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-xl sm:rounded-xl border border-dark-border overflow-hidden">
            <div className="p-4 border-b border-dark-border">
              <h2 className="text-lg font-semibold">🏋️ Итог тренировки</h2>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm">{sessionSummary?.summary || 'Тренировка завершена'}</p>

              {Array.isArray(sessionSummary?.highlights) && sessionSummary.highlights.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Highlights</div>
                  <div className="space-y-1">
                    {sessionSummary.highlights.map((item, idx) => (
                      <div key={`${item}-${idx}`} className="text-sm text-dark-muted">
                        • {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(sessionSummary?.suggestions) && sessionSummary.suggestions.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Рекомендации</div>
                  <div className="space-y-1">
                    {sessionSummary.suggestions.map((item, idx) => (
                      <div key={`${item}-${idx}`} className="text-sm text-dark-muted">
                        • {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={generateTrainingPlan}
                  disabled={creatingPlan}
                  className="btn-primary flex-1"
                >
                  {creatingPlan ? 'Генерация...' : 'Сгенерировать план'}
                </button>
                <button type="button" onClick={goToWorkoutDetails} className="btn-secondary flex-1">
                  К деталям
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

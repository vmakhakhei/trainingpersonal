import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, X, Dumbbell } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import SuggestionPill from '../components/AI/SuggestionPill';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';
import {
  applyWeightChange,
  formatWeightValue,
  requestAutofillSuggestion,
  requestSessionSummary
} from '../lib/aiSuggest';
import { callToolsApi } from '../lib/toolsClient';

function parseNumberInput(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Проверяем есть ли реальный URL для tools API ────────────────────────────
// Если не задан или это локалхост — features деградируют без ошибок
function hasToolsApi() {
  const url = import.meta.env.VITE_TOOLS_API_URL;
  return url && !url.includes('localhost') && !url.includes('127.0.0.1');
}

export default function LogWorkoutPage() {
  const navigate = useNavigate();

  const [workout, setWorkout] = useState(null);
  const [workoutCreating, setWorkoutCreating] = useState(false);
  const workoutRef = useRef(null);

  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [sets, setSets] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [finishingWorkout, setFinishingWorkout] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [autofillSuggestion, setAutofillSuggestion] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [pastSetsSuggestions, setPastSetsSuggestions] = useState([]);
  const [loadingPastSuggestions, setLoadingPastSuggestions] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [exerciseHistory, setExerciseHistory] = useState({});

  const [quickSet, setQuickSet] = useState({ weight_kg: '', reps: '', rpe: '' });

  useEffect(() => { workoutRef.current = workout; }, [workout]);

  const selectedExerciseSets = useMemo(() =>
    !selectedExercise?.id ? [] : sets.filter(s => s.exercise_id === selectedExercise.id),
    [sets, selectedExercise?.id]
  );
  const lastExerciseSet = selectedExerciseSets.at(-1) ?? null;
  const canChangeWeight =
    parseNumberInput(quickSet.weight_kg) !== null ||
    parseNumberInput(lastExerciseSet?.weight_kg) !== null ||
    parseNumberInput(autofillSuggestion?.payload?.weight_kg) !== null;

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadExercises();
    return () => {
      // Cleanup: удаляем тренировку если ушли без подходов
      const w = workoutRef.current;
      if (w?.id) {
        supabase.from('workouts').select('total_volume_kg').eq('id', w.id).single()
          .then(({ data }) => {
            if (data && (parseFloat(data.total_volume_kg) || 0) === 0) {
              supabase.from('workouts')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', w.id).then(() => { });
            }
          });
      }
    };
  }, []);

  // ─── Autofill suggestion ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedExercise?.id || !workout?.id) { setAutofillSuggestion(null); return; }
      try {
        setLoadingSuggestion(true);
        const recentSets = sets.filter(s => s.exercise_id === selectedExercise.id).slice(-3)
          .map(s => ({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe }));
        const suggestion = await requestAutofillSuggestion({
          exerciseId: selectedExercise.id, workoutId: workout.id, recentSets
        });
        if (!cancelled) setAutofillSuggestion(suggestion);
      } catch (e) {
        if (!cancelled) { console.error(e); setAutofillSuggestion(null); }
      } finally {
        if (!cancelled) setLoadingSuggestion(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedExercise?.id, workout?.id, sets]);

  // ─── Past sets — только если tools API задан ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const tid = setTimeout(async () => {
      if (!selectedExercise?.id || !workout?.id) {
        setPastSetsSuggestions([]); setExerciseHistory({}); return;
      }

      // ─── ФИКС: пропускаем если нет реального tools API ───────────────────
      if (!hasToolsApi()) {
        // Загружаем историю напрямую из Supabase вместо tools API
        try {
          const { data: history } = await supabase
            .from('exercise_progress')
            .select('weight_kg, reps, rpe, workout_date')
            .eq('user_id', SINGLE_USER_ID)
            .eq('exercise_id', selectedExercise.id)
            .order('workout_date', { ascending: false })
            .limit(30);

          if (cancelled || !history?.length) return;

          // Группируем по дате
          const grouped = {};
          history.forEach(row => {
            const d = row.workout_date;
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push({ weight_kg: parseFloat(row.weight_kg), reps: row.reps, rpe: row.rpe });
          });

          const lastDate = Object.keys(grouped).sort().reverse()[0];
          const lastSets = grouped[lastDate] || [];

          setPastSetsSuggestions(lastSets);
          setExerciseHistory(grouped);

          // Автозаполнение формы первым подходом если пустая
          const first = lastSets[0];
          if (first) {
            setQuickSet(prev => {
              if (prev.weight_kg || prev.reps) return prev;
              return {
                weight_kg: first.weight_kg != null ? formatWeightValue(first.weight_kg) : '',
                reps: first.reps != null ? String(first.reps) : '',
                rpe: first.rpe != null ? String(first.rpe) : '',
              };
            });
          }
        } catch (e) {
          console.error('History load error:', e);
        } finally {
          if (!cancelled) setLoadingPastSuggestions(false);
        }
        return;
      }

      // tools API доступен — используем его
      try {
        setLoadingPastSuggestions(true);
        const response = await callToolsApi({
          tool: 'suggest_past_sets',
          arguments: { exercise_id: selectedExercise.id, exclude_set_ids: [], limit_workouts: 3 }
        });
        if (cancelled) return;
        if (response?.past_sets) {
          setPastSetsSuggestions(response.past_sets);
          setExerciseHistory(response.grouped_by_date || {});
          const first = response.past_sets[0];
          if (first) {
            setQuickSet(prev => {
              if (prev.weight_kg || prev.reps) return prev;
              return {
                weight_kg: first.weight_kg != null ? formatWeightValue(first.weight_kg) : prev.weight_kg,
                reps: first.reps != null ? String(first.reps) : prev.reps,
                rpe: first.rpe != null ? String(first.rpe) : '',
              };
            });
          }
        }
      } catch (e) {
        console.error('Past sets error:', e);
        if (!cancelled) { setPastSetsSuggestions([]); setExerciseHistory({}); }
      } finally {
        if (!cancelled) setLoadingPastSuggestions(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(tid); };
  }, [selectedExercise?.id, workout?.id]);

  async function loadExercises() {
    const { data, error } = await supabase.from('exercises').select('*')
      .eq('is_deleted', false).order('name_ru');
    if (!error && data) setExercises(data);
  }

  async function ensureWorkoutCreated() {
    if (workoutRef.current) return workoutRef.current;
    if (workoutCreating) return null;
    try {
      setWorkoutCreating(true);
      const { data, error } = await supabase.from('workouts').insert({
        user_id: SINGLE_USER_ID,
        workout_date: new Date().toISOString().split('T')[0],
        start_time: new Date().toISOString()
      }).select().single();
      if (error) throw error;
      setWorkout(data);
      workoutRef.current = data;
      return data;
    } catch (e) {
      console.error('Error creating workout:', e);
      alert('Ошибка создания тренировки');
      return null;
    } finally {
      setWorkoutCreating(false);
    }
  }

  function applySetToQuickForm(payload) {
    if (!payload) return;
    setQuickSet(prev => ({
      weight_kg: payload.weight_kg != null ? formatWeightValue(payload.weight_kg) : prev.weight_kg,
      reps: payload.reps != null ? String(payload.reps) : prev.reps,
      rpe: payload.rpe != null ? String(payload.rpe) : '',
    }));
  }

  function repeatLastSet() { if (lastExerciseSet) applySetToQuickForm(lastExerciseSet); }

  function adjustWeight(multiplier) {
    const next = applyWeightChange({
      currentWeight: quickSet.weight_kg,
      fallbackWeight: lastExerciseSet?.weight_kg ?? autofillSuggestion?.payload?.weight_kg,
      multiplier
    });
    if (next) setQuickSet(prev => ({ ...prev, weight_kg: next }));
  }

  async function addSetWithValues(weight_kg_raw, reps_raw, rpe_raw) {
    if (!selectedExercise) { alert('Выберите упражнение'); return; }
    const weight = parseNumberInput(weight_kg_raw);
    const reps = parseInt(reps_raw, 10);
    const parsedRpe = parseNumberInput(rpe_raw);
    const rpe = parsedRpe !== null && parsedRpe > 0 ? parsedRpe : null;

    if (!weight_kg_raw || !reps_raw) { alert('Заполните вес и повторения'); return; }
    if (weight === null || weight < 0) { alert('Вес должен быть ≥ 0'); return; }
    if (isNaN(reps) || reps < 1) { alert('Повторения ≥ 1'); return; }
    if (rpe !== null && (rpe < 1 || rpe > 10)) { alert('RPE от 1 до 10'); return; }

    const w = await ensureWorkoutCreated();
    if (!w) return;

    try {
      const currentSets = sets.filter(s => s.exercise_id === selectedExercise.id);
      const { data, error } = await supabase.from('sets').insert({
        workout_id: w.id,
        exercise_id: selectedExercise.id,
        set_order: currentSets.length + 1,
        weight_kg: weight, reps, rpe
      }).select('*, exercises(name_ru, primary_muscle)').single();

      if (error) throw error;
      setSets(prev => [...prev, data]);

      setAutofillSuggestion({
        id: 's-local', type: 'autofill',
        payload: { weight_kg: data.weight_kg, reps: data.reps, rpe: data.rpe },
        confidence: 0.9, explain: `последний подход: ${data.weight_kg}×${data.reps}`, sources: []
      });

      const nextIdx = currentSets.length;
      if (pastSetsSuggestions.length > nextIdx) {
        applySetToQuickForm(pastSetsSuggestions[nextIdx]);
      } else {
        setQuickSet(prev => ({ ...prev, reps: '', rpe: '' }));
      }
    } catch (e) {
      console.error('Error adding set:', e);
      alert('Ошибка добавления подхода');
    }
  }

  function addSet() {
    addSetWithValues(quickSet.weight_kg, quickSet.reps, quickSet.rpe);
  }

  function handleAddSetFromHistory(set) {
    addSetWithValues(
      set.weight_kg != null ? String(set.weight_kg) : '',
      set.reps != null ? String(set.reps) : '',
      set.rpe != null ? String(set.rpe) : ''
    );
  }

  function handleAddAllFromDate(date) {
    const dateSets = exerciseHistory[date] || [];
    dateSets.forEach((s, i) => {
      setTimeout(() => addSetWithValues(
        s.weight_kg != null ? String(s.weight_kg) : '',
        s.reps != null ? String(s.reps) : '',
        s.rpe != null ? String(s.rpe) : ''
      ), i * 150);
    });
  }

  function fallbackSummary() {
    return {
      summary: 'Тренировка завершена',
      highlights: [`Подходов: ${sets.length}`],
      suggestions: ['Продолжайте фиксировать рабочие подходы для более точных рекомендаций']
    };
  }

  async function finishWorkout() {
    if (finishingWorkout) return;
    if (sets.length === 0) { navigate('/'); return; }
    if (!workout?.id) return;
    try {
      setFinishingWorkout(true);
      const { error } = await supabase.from('workouts')
        .update({ end_time: new Date().toISOString() }).eq('id', workout.id);
      if (error) throw error;
      try {
        const summary = await requestSessionSummary({
          workoutId: workout.id,
          recentSets: sets.map(s => ({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe }))
        });
        setSessionSummary(summary);
      } catch {
        setSessionSummary(fallbackSummary());
      }
      setShowSummaryModal(true);
    } catch (e) {
      console.error('Error finishing workout:', e);
      alert('Ошибка завершения тренировки');
    } finally {
      setFinishingWorkout(false);
    }
  }

  // ─── ФИКС: план всегда создаётся напрямую в Supabase ─────────────────────
  // callToolsApi убран — tools сервер не задеплоен на Vercel
  async function generateTrainingPlan() {
    if (creatingPlan) return;
    try {
      setCreatingPlan(true);
      const { error } = await supabase.from('workout_plans').insert({
        user_id: SINGLE_USER_ID,
        name: `AI План ${new Date().toLocaleDateString('ru-RU')}`,
        description: sessionSummary?.summary || 'План создан после тренировки',
        goal: 'strength',
        days_per_week: 3,
        duration_weeks: 8
      }).select('id').single();
      if (error) throw error;
      alert('План успешно создан');
    } catch (e) {
      console.error('Create plan error:', e);
      alert(`Ошибка создания плана: ${e.message}`);
    } finally {
      setCreatingPlan(false);
    }
  }

  function goToWorkoutDetails() {
    setShowSummaryModal(false);
    navigate(`/workouts/${workout.id}`);
  }

  const finishLabel = finishingWorkout ? 'Завершение...' : sets.length === 0 ? 'Отмена' : 'Завершить';

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <div className="bg-dark-surface border-b border-dark-border p-4 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Новая тренировка</h1>
            {sets.length > 0 && (
              <p className="text-xs text-dark-muted mt-0.5">
                {sets.length} {sets.length === 1 ? 'подход' : sets.length < 5 ? 'подхода' : 'подходов'}
                {` · ${Math.round(sets.reduce((s, x) => s + (parseFloat(x.weight_kg) || 0) * (x.reps || 0), 0))} кг`}
              </p>
            )}
          </div>
          <button onClick={finishWorkout} disabled={finishingWorkout} className="btn-primary flex items-center space-x-2">
            <Save className="w-5 h-5" /><span>{finishLabel}</span>
          </button>
        </div>
      </div>

      {!selectedExercise ? (
        <div className="p-4">
          <button onClick={() => setShowExercisePicker(true)} className="w-full card-elevated py-8 text-center">
            <Plus className="w-12 h-12 mx-auto text-primary-500 mb-3" />
            <p className="font-medium">Выберите упражнение</p>
            {sets.length > 0 && <p className="text-sm text-dark-muted mt-1">или завершите тренировку</p>}
          </button>

          {sets.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-dark-muted font-medium">В этой тренировке:</p>
              {[...new Set(sets.map(s => s.exercise_id))].map(exId => {
                const exSets = sets.filter(s => s.exercise_id === exId);
                const exName = exSets[0]?.exercises?.name_ru || 'Упражнение';
                const vol = exSets.reduce((s, x) => s + (parseFloat(x.weight_kg) || 0) * (x.reps || 0), 0);
                return (
                  <div key={exId} className="card flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{exName}</p>
                      <p className="text-xs text-dark-muted">{exSets.length} подходов · {Math.round(vol)} кг</p>
                    </div>
                    <button onClick={() => { const ex = exercises.find(e => e.id === exId); if (ex) setSelectedExercise(ex); }}
                      className="text-xs text-primary-500 hover:text-primary-400">+ подход</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Dumbbell className="w-6 h-6 text-primary-500" />
                <div>
                  <div className="font-semibold">{selectedExercise.name_ru}</div>
                  <div className="text-sm text-dark-muted">{selectedExercise.primary_muscle}</div>
                </div>
              </div>
              <button onClick={() => setSelectedExercise(null)} className="p-2 hover:bg-dark-elevated rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="card">
            <div className="text-sm font-medium mb-3">Быстрое добавление подхода</div>

            {loadingPastSuggestions && (
              <div className="mb-3 text-xs text-dark-muted">Загрузка истории...</div>
            )}
            {!loadingPastSuggestions && pastSetsSuggestions.length > 0 && (
              <div className="mb-4 p-3 border border-primary-500/30 rounded-lg bg-primary-500/5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium">История упражнения</div>
                  <div className="text-xs text-dark-muted">{pastSetsSuggestions.length} подходов</div>
                </div>
                {selectedExerciseSets.length < pastSetsSuggestions.length ? (
                  <p className="text-xs text-dark-muted mb-2">
                    Подход {selectedExerciseSets.length + 1}: {pastSetsSuggestions[selectedExerciseSets.length]?.weight_kg} кг × {pastSetsSuggestions[selectedExerciseSets.length]?.reps}
                  </p>
                ) : (
                  <p className="text-xs text-dark-muted mb-2">Все подходы из истории использованы</p>
                )}
                <button type="button" onClick={() => setShowHistoryModal(true)} className="btn-secondary text-sm px-3 py-2">
                  Показать историю
                </button>
              </div>
            )}

            {!loadingSuggestion && autofillSuggestion && (
              <div className="mb-3">
                <SuggestionPill suggestion={autofillSuggestion} onApply={applySetToQuickForm} />
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={repeatLastSet} disabled={!lastExerciseSet} className="btn-secondary text-sm px-3 py-2">Повторить</button>
              <button type="button" onClick={() => adjustWeight(1.05)} disabled={!canChangeWeight} className="btn-secondary text-sm px-3 py-2">+5%</button>
              <button type="button" onClick={() => adjustWeight(0.95)} disabled={!canChangeWeight} className="btn-secondary text-sm px-3 py-2">-5%</button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-dark-muted">Вес (кг)</label>
                <input type="number" value={quickSet.weight_kg}
                  onChange={e => setQuickSet(p => ({ ...p, weight_kg: e.target.value }))}
                  className="input-field w-full mt-1" placeholder="100" step="0.5" min="0" />
              </div>
              <div>
                <label className="text-xs text-dark-muted">Повторения</label>
                <input type="number" value={quickSet.reps}
                  onChange={e => setQuickSet(p => ({ ...p, reps: e.target.value }))}
                  className="input-field w-full mt-1" placeholder="10" min="1" />
              </div>
              <div>
                <label className="text-xs text-dark-muted">RPE</label>
                <input type="number" value={quickSet.rpe}
                  onChange={e => setQuickSet(p => ({ ...p, rpe: e.target.value }))}
                  className="input-field w-full mt-1" placeholder="опц." min="0" max="10" step="0.5" />
              </div>
            </div>

            <button onClick={addSet} disabled={workoutCreating} className="btn-primary w-full">
              <Plus className="w-5 h-5 inline mr-2" />
              {workoutCreating ? 'Создаём тренировку...' : 'Добавить подход'}
            </button>
          </div>

          <div className="space-y-2">
            {selectedExerciseSets.map((set, idx) => (
              <div key={set.id} className="card flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-dark-muted font-mono text-sm">#{idx + 1}</div>
                  <div>
                    <div className="font-semibold">{set.weight_kg} кг × {set.reps}</div>
                    {set.rpe && <div className="text-sm text-dark-muted">RPE: {set.rpe}</div>}
                  </div>
                </div>
                <div className="text-xs text-dark-muted">
                  {Math.round((parseFloat(set.weight_kg) || 0) * (set.reps || 0))} кг
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Picker */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-lg sm:rounded-xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h2 className="font-semibold">Выбрать упражнение</h2>
              <button onClick={() => setShowExercisePicker(false)} className="p-2"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
              {exercises.map(exercise => (
                <button key={exercise.id}
                  onClick={() => { setSelectedExercise(exercise); setAutofillSuggestion(null); setShowExercisePicker(false); }}
                  className="w-full card hover:bg-dark-elevated transition-colors text-left">
                  <div className="font-medium">{exercise.name_ru}</div>
                  <div className="text-sm text-dark-muted">{exercise.primary_muscle}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-xl sm:rounded-xl border border-dark-border overflow-hidden">
            <div className="p-4 border-b border-dark-border">
              <h2 className="text-lg font-semibold">🏋️ Итог тренировки</h2>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm">{sessionSummary?.summary || 'Тренировка завершена'}</p>
              {sessionSummary?.highlights?.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Highlights</div>
                  {sessionSummary.highlights.map((item, i) => (
                    <div key={i} className="text-sm text-dark-muted">• {item}</div>
                  ))}
                </div>
              )}
              {sessionSummary?.suggestions?.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Рекомендации</div>
                  {sessionSummary.suggestions.map((item, i) => (
                    <div key={i} className="text-sm text-dark-muted">• {item}</div>
                  ))}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={generateTrainingPlan} disabled={creatingPlan} className="btn-primary flex-1">
                  {creatingPlan ? 'Создаём план...' : 'Сгенерировать план'}
                </button>
                <button type="button" onClick={goToWorkoutDetails} className="btn-secondary flex-1">
                  К деталям
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ExerciseHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        exerciseName={selectedExercise?.name_ru}
        history={exerciseHistory}
        onAddSet={handleAddSetFromHistory}
        onAddAllFromDate={handleAddAllFromDate}
      />
    </div>
  );
}

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, X, Dumbbell, Clock, History, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';
import {
  applyWeightChange,
  formatWeightValue,
  requestSessionSummary
} from '../lib/aiSuggest';

function parseNumberInput(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function repsLabel(n) {
  if (n === 1) return 'повторение';
  if (n >= 2 && n <= 4) return 'повторения';
  return 'повторений';
}

// ─── Компонент: баннер "из прошлой тренировки" ───────────────────────────────
function HistoryBanner({ date, setsTotal, currentSetIndex }) {
  const dateStr = date
    ? format(parseISO(date), 'd MMMM', { locale: ru })
    : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600/10 border border-primary-600/20 mb-3">
      <Clock className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
      <p className="text-xs text-primary-300 flex-1">
        Заполнено из тренировки
        {dateStr ? <span className="font-medium text-primary-200"> {dateStr}</span> : ''}
        {setsTotal > 0 && (
          <span className="text-primary-400">
            {' '}· подход {Math.min(currentSetIndex + 1, setsTotal)} из {setsTotal}
          </span>
        )}
      </p>
    </div>
  );
}

// ─── Компонент: карточка добавленного сета ────────────────────────────────────
function SetCard({ set, index, isFromHistory }) {
  const vol = Math.round((parseFloat(set.weight_kg) || 0) * (set.reps || 0));
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all
      ${isFromHistory
        ? 'bg-dark-elevated border-dark-border'
        : 'bg-dark-surface border-primary-600/30 shadow-sm'}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-dark-muted w-5">#{index + 1}</span>
        <div>
          <span className="font-semibold">
            {set.weight_kg} кг × {set.reps}
          </span>
          {set.rpe && (
            <span className="text-xs text-dark-muted ml-2">RPE {set.rpe}</span>
          )}
        </div>
      </div>
      <span className="text-sm text-dark-muted">{vol} кг</span>
    </div>
  );
}

// ─── Компонент: модал шаблона тренировки ─────────────────────────────────────
function SaveTemplateModal({ exercises, sets, onSave, onSkip }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Группируем упражнения
  const exerciseSummary = exercises.map(ex => {
    const exSets = sets.filter(s => s.exercise_id === ex.id);
    return { ...ex, setsCount: exSets.length };
  });

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // 1. Создаём план
      const { data: plan, error: planErr } = await supabase
        .from('workout_plans')
        .insert({
          user_id:       SINGLE_USER_ID,
          name:          name.trim(),
          description:   `Шаблон из тренировки ${format(new Date(), 'd MMMM yyyy', { locale: ru })}`,
          goal:          'strength',
          days_per_week: 1,
          duration_weeks: 1,
        })
        .select('id')
        .single();
      if (planErr) throw planErr;

      // 2. Добавляем упражнения
      const planExercises = exerciseSummary.map((ex, i) => ({
        plan_id:       plan.id,
        exercise_id:   ex.id,
        day_number:    1,
        exercise_order: i + 1,
        target_sets:   ex.setsCount,
        target_reps_min: null,
        target_reps_max: null,
      }));
      const { error: exErr } = await supabase.from('plan_exercises').insert(planExercises);
      if (exErr) throw exErr;

      onSave(plan.id);
    } catch (e) {
      console.error('Save template error:', e);
      alert('Ошибка сохранения шаблона');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onSkip} />
      <div className="relative w-full max-w-lg bg-dark-surface rounded-t-2xl border-t border-dark-border p-5 pb-8">
        <div className="w-10 h-1 bg-dark-border rounded-full mx-auto mb-5" />
        <h3 className="font-semibold text-lg mb-1">Сохранить как шаблон?</h3>
        <p className="text-sm text-dark-muted mb-4">
          Создай шаблон, чтобы быстро повторить эту тренировку
        </p>

        <div className="space-y-2 mb-4">
          {exerciseSummary.map(ex => (
            <div key={ex.id} className="flex items-center gap-2 text-sm">
              <Dumbbell className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <span>{ex.name_ru}</span>
              <span className="text-dark-muted">· {ex.setsCount} подх.</span>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <label className="text-sm text-dark-muted block mb-2">Название шаблона</label>
          <input
            type="text"
            placeholder={`Тренировка ${format(new Date(), 'd MMMM', { locale: ru })}`}
            value={name}
            onChange={e => setName(e.target.value)}
            className="input-field w-full"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1"
          >
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button onClick={onSkip} className="btn-secondary flex-1">
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ГЛАВНЫЙ КОМПОНЕНТ ────────────────────────────────────────────────────────
export default function LogWorkoutPage() {
  const navigate = useNavigate();

  const [workout, setWorkout]               = useState(null);
  const [workoutCreating, setWorkoutCreating] = useState(false);
  const workoutRef = useRef(null);

  const [exercises, setExercises]           = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  // Порядок упражнений в текущей тренировке
  const [workoutExercises, setWorkoutExercises] = useState([]); // [{id, name_ru, primary_muscle}]
  const [sets, setSets]                     = useState([]);

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [finishingWorkout, setFinishingWorkout] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [sessionSummary, setSessionSummary]       = useState(null);

  // ─── История: загружается при выборе упражнения ──────────────────────────
  // { date: '2025-03-01', sets: [{weight_kg, reps, rpe}] } | null
  const [pastHistory, setPastHistory]             = useState(null);
  const [loadingHistory, setLoadingHistory]       = useState(false);
  const [showHistoryModal, setShowHistoryModal]   = useState(false);
  const [fullHistory, setFullHistory]             = useState({}); // grouped_by_date

  const [quickSet, setQuickSet] = useState({ weight_kg: '', reps: '', rpe: '' });

  // Синхронизируем ref для cleanup
  useEffect(() => { workoutRef.current = workout; }, [workout]);

  const selectedExerciseSets = useMemo(() =>
    !selectedExercise?.id ? [] : sets.filter(s => s.exercise_id === selectedExercise.id),
    [sets, selectedExercise?.id]
  );

  const lastExerciseSet = selectedExerciseSets.at(-1) ?? null;

  const canChangeWeight =
    parseNumberInput(quickSet.weight_kg) !== null ||
    parseNumberInput(lastExerciseSet?.weight_kg) !== null;

  // ─── Cleanup: мягкое удаление пустой тренировки при уходе ────────────────
  useEffect(() => {
    loadExercises();
    return () => {
      const w = workoutRef.current;
      if (!w?.id) return;
      supabase.from('workouts').select('total_volume_kg').eq('id', w.id).single()
        .then(({ data }) => {
          if (data && (parseFloat(data.total_volume_kg) || 0) === 0) {
            supabase.from('workouts')
              .update({ is_deleted: true, deleted_at: new Date().toISOString() })
              .eq('id', w.id).then(() => {});
          }
        });
    };
  }, []);

  // ─── КЛЮЧЕВОЙ ФИКС: история загружается ТОЛЬКО по selectedExercise.id ────
  // Не зависит от workout.id — работает до первого подхода
  useEffect(() => {
    if (!selectedExercise?.id) {
      setPastHistory(null);
      setFullHistory({});
      return;
    }

    let cancelled = false;
    setLoadingHistory(true);
    setPastHistory(null);

    async function loadHistory() {
      try {
        // Получаем последние N подходов из exercise_progress view
        const { data } = await supabase
          .from('exercise_progress')
          .select('weight_kg, reps, rpe, workout_date')
          .eq('user_id', SINGLE_USER_ID)
          .eq('exercise_id', selectedExercise.id)
          .order('workout_date', { ascending: false })
          .order('set_order', { ascending: true })  // порядок внутри тренировки
          .limit(50);

        if (cancelled || !data?.length) return;

        // Группируем по дате
        const grouped = {};
        data.forEach(row => {
          const d = row.workout_date;
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push({
            weight_kg: parseFloat(row.weight_kg),
            reps:      row.reps,
            rpe:       row.rpe,
          });
        });

        setFullHistory(grouped);

        // Берём ПОСЛЕДНЮЮ дату (исключая текущую тренировку если есть)
        const today = new Date().toISOString().split('T')[0];
        const dates = Object.keys(grouped).sort().reverse();
        const lastDate = dates[0] === today ? dates[1] : dates[0];

        if (!lastDate) return;

        const historySets = grouped[lastDate] || [];

        if (!cancelled) {
          setPastHistory({ date: lastDate, sets: historySets });

          // Автозаполнение: первый подход из предыдущей тренировки
          const firstSet = historySets[0];
          if (firstSet) {
            setQuickSet({
              weight_kg: formatWeightValue(firstSet.weight_kg),
              reps:      String(firstSet.reps),
              rpe:       firstSet.rpe != null ? String(firstSet.rpe) : '',
            });
          }
        }
      } catch (e) {
        console.error('History load error:', e);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [selectedExercise?.id]); // ← только exercise_id, без workout.id!

  // ─── При добавлении подхода — автозаполнение следующего из истории ────────
  function advanceHistoryPrefill(newSetsCount) {
    if (!pastHistory?.sets) return;
    const nextSet = pastHistory.sets[newSetsCount]; // индекс = количество уже добавленных
    if (nextSet) {
      setQuickSet({
        weight_kg: formatWeightValue(nextSet.weight_kg),
        reps:      String(nextSet.reps),
        rpe:       nextSet.rpe != null ? String(nextSet.rpe) : '',
      });
    } else {
      // История закончилась — оставляем вес, очищаем повторения
      setQuickSet(prev => ({ ...prev, reps: '', rpe: '' }));
    }
  }

  async function loadExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('is_deleted', false)
      .order('name_ru');
    if (data) setExercises(data);
  }

  async function ensureWorkoutCreated() {
    if (workoutRef.current) return workoutRef.current;
    if (workoutCreating) return null;
    try {
      setWorkoutCreating(true);
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id:      SINGLE_USER_ID,
          workout_date: new Date().toISOString().split('T')[0],
          start_time:   new Date().toISOString(),
        })
        .select()
        .single();
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

  function adjustWeight(multiplier) {
    const next = applyWeightChange({
      currentWeight:  quickSet.weight_kg,
      fallbackWeight: lastExerciseSet?.weight_kg,
      multiplier,
    });
    if (next) setQuickSet(prev => ({ ...prev, weight_kg: next }));
  }

  // ─── Добавление подхода (принимает явные значения — нет race condition) ───
  async function addSetWithValues(weight_kg_raw, reps_raw, rpe_raw) {
    const weight = parseNumberInput(weight_kg_raw);
    const reps   = parseInt(reps_raw, 10);
    const parsedRpe = parseNumberInput(rpe_raw);
    const rpe    = parsedRpe !== null && parsedRpe > 0 ? parsedRpe : null;

    if (!weight_kg_raw || !reps_raw) { alert('Заполни вес и повторения'); return; }
    if (weight === null || weight < 0) { alert('Вес ≥ 0 кг'); return; }
    if (isNaN(reps) || reps < 1) { alert('Повторений ≥ 1'); return; }
    if (rpe !== null && (rpe < 1 || rpe > 10)) { alert('RPE от 1 до 10'); return; }

    const w = await ensureWorkoutCreated();
    if (!w) return;

    try {
      const currentSetsForExercise = sets.filter(s => s.exercise_id === selectedExercise.id);

      const { data, error } = await supabase
        .from('sets')
        .insert({
          workout_id:  w.id,
          exercise_id: selectedExercise.id,
          set_order:   currentSetsForExercise.length + 1,
          weight_kg:   weight,
          reps,
          rpe,
        })
        .select('*, exercises(name_ru, primary_muscle)')
        .single();

      if (error) throw error;

      const newSets = [...sets, data];
      setSets(newSets);

      // Запоминаем упражнение в списке тренировки (если первый раз)
      if (!workoutExercises.find(e => e.id === selectedExercise.id)) {
        setWorkoutExercises(prev => [...prev, selectedExercise]);
      }

      // Автозаполнение следующего подхода из истории
      advanceHistoryPrefill(currentSetsForExercise.length + 1);
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
      set.reps      != null ? String(set.reps)      : '',
      set.rpe       != null ? String(set.rpe)       : ''
    );
  }

  async function finishWorkout() {
    if (finishingWorkout) return;
    if (sets.length === 0) { navigate('/'); return; }
    if (!workout?.id) return;

    try {
      setFinishingWorkout(true);
      await supabase.from('workouts')
        .update({ end_time: new Date().toISOString() })
        .eq('id', workout.id);

      let summary = null;
      try {
        summary = await requestSessionSummary({
          workoutId: workout.id,
          recentSets: sets.map(s => ({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe })),
        });
      } catch {
        summary = {
          summary: `Отличная тренировка! ${sets.length} подходов, ${Math.round(
            sets.reduce((s, x) => s + (parseFloat(x.weight_kg) || 0) * (x.reps || 0), 0)
          )} кг объёма.`,
          highlights: [`Упражнений: ${workoutExercises.length}`, `Подходов: ${sets.length}`],
          suggestions: [],
        };
      }
      setSessionSummary(summary);
      setShowSummaryModal(true);
    } catch (e) {
      console.error('Error finishing:', e);
      alert('Ошибка завершения тренировки');
    } finally {
      setFinishingWorkout(false);
    }
  }

  const totalVolume = Math.round(
    sets.reduce((s, x) => s + (parseFloat(x.weight_kg) || 0) * (x.reps || 0), 0)
  );

  // Текущий индекс подхода для баннера
  const currentHistoryIdx = selectedExerciseSets.length;
  const showHistoryBanner = pastHistory && !loadingHistory && pastHistory.sets.length > 0;

  return (
    <div className="min-h-screen bg-dark-bg">

      {/* ─── Header ─── */}
      <div className="bg-dark-surface border-b border-dark-border p-4 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Новая тренировка</h1>
            {sets.length > 0 && (
              <p className="text-xs text-dark-muted mt-0.5">
                {sets.length} подх. · {totalVolume.toLocaleString('ru')} кг объёма
              </p>
            )}
          </div>
          <button
            onClick={finishWorkout}
            disabled={finishingWorkout}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>
              {finishingWorkout ? 'Завершение...' : sets.length === 0 ? 'Отмена' : 'Завершить'}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Контент ─── */}
      {!selectedExercise ? (
        <div className="p-4 space-y-4">

          {/* Добавить упражнение */}
          <button
            onClick={() => setShowExercisePicker(true)}
            className="w-full card-elevated py-8 text-center hover:border-primary-500/50 transition-all"
          >
            <Plus className="w-10 h-10 mx-auto text-primary-500 mb-2" />
            <p className="font-medium">Выбрать упражнение</p>
            {sets.length > 0 && (
              <p className="text-sm text-dark-muted mt-1">или завершите тренировку</p>
            )}
          </button>

          {/* Уже добавленные упражнения */}
          {workoutExercises.length > 0 && (
            <div>
              <p className="text-xs text-dark-muted font-medium mb-2 px-1">В этой тренировке</p>
              <div className="space-y-2">
                {workoutExercises.map(ex => {
                  const exSets = sets.filter(s => s.exercise_id === ex.id);
                  const vol    = exSets.reduce((s, x) => s + (parseFloat(x.weight_kg) || 0) * (x.reps || 0), 0);
                  return (
                    <button
                      key={ex.id}
                      onClick={() => setSelectedExercise(ex)}
                      className="w-full card flex items-center gap-3 text-left hover:bg-dark-elevated transition-colors"
                    >
                      <Dumbbell className="w-5 h-5 text-primary-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{ex.name_ru}</p>
                        <p className="text-xs text-dark-muted">
                          {exSets.length} подходов · {Math.round(vol)} кг
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-dark-muted" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      ) : (
        <div className="p-4 space-y-3">

          {/* ─── Карточка выбранного упражнения ─── */}
          <div className="card">
            <div className="flex items-center gap-3">
              <Dumbbell className="w-5 h-5 text-primary-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{selectedExercise.name_ru}</p>
                <p className="text-xs text-dark-muted">{selectedExercise.primary_muscle}</p>
              </div>
              {/* Кнопка История */}
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-1 text-xs text-dark-muted hover:text-primary-400
                           bg-dark-elevated rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                История
              </button>
              <button
                onClick={() => setSelectedExercise(null)}
                className="p-1.5 hover:bg-dark-elevated rounded-lg transition-colors text-dark-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ─── Форма быстрого добавления ─── */}
          <div className="card space-y-3">
            <p className="text-sm font-medium">
              Подход {selectedExerciseSets.length + 1}
            </p>

            {/* Баннер истории */}
            {loadingHistory && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-elevated border border-dark-border">
                <div className="w-3 h-3 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
                <p className="text-xs text-dark-muted">Загружаем историю...</p>
              </div>
            )}

            {showHistoryBanner && (
              <HistoryBanner
                date={pastHistory.date}
                setsTotal={pastHistory.sets.length}
                currentSetIndex={currentHistoryIdx}
              />
            )}

            {/* Кнопки быстрого изменения */}
            <div className="flex gap-2 flex-wrap">
              {lastExerciseSet && (
                <button
                  type="button"
                  onClick={() => setQuickSet({
                    weight_kg: formatWeightValue(lastExerciseSet.weight_kg),
                    reps:      String(lastExerciseSet.reps),
                    rpe:       lastExerciseSet.rpe != null ? String(lastExerciseSet.rpe) : '',
                  })}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Повторить
                </button>
              )}
              <button
                type="button"
                onClick={() => adjustWeight(1.05)}
                disabled={!canChangeWeight}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                +5%
              </button>
              <button
                type="button"
                onClick={() => adjustWeight(0.95)}
                disabled={!canChangeWeight}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                −5%
              </button>
            </div>

            {/* Поля ввода */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-dark-muted mb-1 block">Вес, кг</label>
                <input
                  type="number"
                  value={quickSet.weight_kg}
                  onChange={e => setQuickSet(p => ({ ...p, weight_kg: e.target.value }))}
                  className="input-field w-full"
                  placeholder="100"
                  step="0.5"
                  min="0"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-xs text-dark-muted mb-1 block">Повторения</label>
                <input
                  type="number"
                  value={quickSet.reps}
                  onChange={e => setQuickSet(p => ({ ...p, reps: e.target.value }))}
                  className="input-field w-full"
                  placeholder="10"
                  min="1"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-xs text-dark-muted mb-1 block">RPE</label>
                <input
                  type="number"
                  value={quickSet.rpe}
                  onChange={e => setQuickSet(p => ({ ...p, rpe: e.target.value }))}
                  className="input-field w-full"
                  placeholder="—"
                  min="1"
                  max="10"
                  step="0.5"
                  inputMode="decimal"
                />
              </div>
            </div>

            <button
              onClick={addSet}
              disabled={workoutCreating}
              className="btn-primary w-full"
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              {workoutCreating ? 'Создаём тренировку...' : 'Добавить подход'}
            </button>
          </div>

          {/* ─── Список добавленных подходов ─── */}
          {selectedExerciseSets.length > 0 && (
            <div className="space-y-2">
              {selectedExerciseSets.map((set, idx) => (
                <SetCard
                  key={set.id}
                  set={set}
                  index={idx}
                  isFromHistory={idx > 0}
                />
              ))}
              <div className="text-right text-xs text-dark-muted pr-1">
                Объём: {Math.round(
                  selectedExerciseSets.reduce((s, x) => s + (parseFloat(x.weight_kg) || 0) * (x.reps || 0), 0)
                ).toLocaleString('ru')} кг
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Пикер упражнений ─── */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-lg sm:rounded-xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h2 className="font-semibold">Выбрать упражнение</h2>
              <button onClick={() => setShowExercisePicker(false)} className="p-2 text-dark-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-3 space-y-1">
              {exercises.map(exercise => (
                <button
                  key={exercise.id}
                  onClick={() => {
                    setSelectedExercise(exercise);
                    setQuickSet({ weight_kg: '', reps: '', rpe: '' });
                    setShowExercisePicker(false);
                  }}
                  className="w-full card hover:bg-dark-elevated transition-colors text-left py-3"
                >
                  <p className="font-medium">{exercise.name_ru}</p>
                  <p className="text-xs text-dark-muted">{exercise.primary_muscle}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Модал итога тренировки ─── */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-xl sm:rounded-xl border border-dark-border overflow-hidden">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Тренировка завершена 🏋️</h2>
            </div>
            <div className="p-4 space-y-4">

              {/* Статы */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-dark-elevated rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{sets.length}</p>
                  <p className="text-xs text-dark-muted">подходов</p>
                </div>
                <div className="bg-dark-elevated rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{workoutExercises.length}</p>
                  <p className="text-xs text-dark-muted">упражнений</p>
                </div>
                <div className="bg-dark-elevated rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">
                    {totalVolume >= 1000
                      ? `${(totalVolume / 1000).toFixed(1)}т`
                      : totalVolume}
                  </p>
                  <p className="text-xs text-dark-muted">объём</p>
                </div>
              </div>

              {sessionSummary?.summary && (
                <p className="text-sm text-dark-muted">{sessionSummary.summary}</p>
              )}

              {sessionSummary?.highlights?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Итоги</p>
                  {sessionSummary.highlights.map((h, i) => (
                    <p key={i} className="text-sm text-dark-muted">· {h}</p>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setShowSummaryModal(false); setShowTemplateModal(true); }}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Сохранить как шаблон
                </button>
                <button
                  onClick={() => navigate(`/workouts/${workout.id}`)}
                  className="btn-primary w-full"
                >
                  Смотреть детали
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Модал сохранения шаблона ─── */}
      {showTemplateModal && (
        <SaveTemplateModal
          exercises={workoutExercises}
          sets={sets}
          onSave={(planId) => {
            setShowTemplateModal(false);
            navigate(`/workouts/${workout.id}`);
          }}
          onSkip={() => {
            setShowTemplateModal(false);
            navigate(`/workouts/${workout.id}`);
          }}
        />
      )}

      {/* ─── История упражнения ─── */}
      <ExerciseHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        exerciseName={selectedExercise?.name_ru}
        history={fullHistory}
        onAddSet={handleAddSetFromHistory}
        onAddAllFromDate={(date) => {
          const dateSets = fullHistory[date] || [];
          dateSets.forEach((s, i) => {
            setTimeout(() => {
              addSetWithValues(
                s.weight_kg != null ? String(s.weight_kg) : '',
                s.reps      != null ? String(s.reps)      : '',
                s.rpe       != null ? String(s.rpe)       : ''
              );
            }, i * 200);
          });
        }}
      />
    </div>
  );
}

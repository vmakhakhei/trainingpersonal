import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Save, X, Dumbbell, Clock, ChevronDown, ChevronUp,
  Pencil, Trash2, Check, History
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import { applyWeightChange, formatWeightValue, requestSessionSummary } from '../lib/aiSuggest';

// ─────────────────────────────────────────────────────────────────────────────
// Утилиты
// ─────────────────────────────────────────────────────────────────────────────
function parseNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

function fmtVol(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}т`;
  return `${Math.round(kg)} кг`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SaveTemplateModal
// ─────────────────────────────────────────────────────────────────────────────
function SaveTemplateModal({ exercises, sets, onSave, onSkip }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data: plan, error: e1 } = await supabase
        .from('workout_plans')
        .insert({
          user_id: SINGLE_USER_ID,
          name: name.trim(),
          description: `Шаблон от ${format(new Date(), 'd MMMM yyyy', { locale: ru })}`,
          goal: 'strength', days_per_week: 1, duration_weeks: 1,
        }).select('id').single();
      if (e1) throw e1;

      const rows = exercises.map((ex, i) => ({
        plan_id: plan.id, exercise_id: ex.id,
        day_number: 1, exercise_order: i + 1,
        target_sets: sets.filter(s => s.exercise_id === ex.id).length,
        target_reps_min: null, target_reps_max: null,
      }));
      const { error: e2 } = await supabase.from('plan_exercises').insert(rows);
      if (e2) throw e2;
      onSave(plan.id);
    } catch (e) {
      console.error(e);
      alert('Ошибка сохранения шаблона');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onSkip} />
      <div className="relative w-full max-w-lg bg-dark-surface rounded-t-2xl border-t border-dark-border p-5 pb-8">
        <div className="w-10 h-1 bg-dark-border rounded-full mx-auto mb-5" />
        <h3 className="font-semibold text-lg mb-1">Сохранить как шаблон?</h3>
        <p className="text-sm text-dark-muted mb-4">Быстро повторить эту тренировку в следующий раз</p>
        <div className="space-y-1.5 mb-4">
          {exercises.map(ex => (
            <div key={ex.id} className="flex items-center gap-2 text-sm py-1">
              <Dumbbell className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <span className="flex-1">{ex.name_ru}</span>
              <span className="text-dark-muted text-xs">
                {sets.filter(s => s.exercise_id === ex.id).length} подх.
              </span>
            </div>
          ))}
        </div>
        <div className="mb-4">
          <label className="text-sm text-dark-muted block mb-2">Название</label>
          <input type="text" autoFocus
            placeholder={`Тренировка ${format(new Date(), 'd MMMM', { locale: ru })}`}
            value={name} onChange={e => setName(e.target.value)}
            className="input-field w-full" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary flex-1">
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button onClick={onSkip} className="btn-secondary flex-1">Пропустить</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SetRow — строка подхода с inline-редактированием
// ─────────────────────────────────────────────────────────────────────────────
function SetRow({ set, index, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    weight_kg: String(set.weight_kg),
    reps: String(set.reps),
    rpe: set.rpe != null ? String(set.rpe) : '',
  });
  const [saving, setSaving] = useState(false);

  async function saveEdit() {
    const w = parseNum(draft.weight_kg);
    const r = parseInt(draft.reps, 10);
    const rpe = parseNum(draft.rpe);
    if (w === null || w < 0 || isNaN(r) || r < 1) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('sets')
        .update({ weight_kg: w, reps: r, rpe: rpe && rpe > 0 ? rpe : null })
        .eq('id', set.id)
        .select('*, exercises(name_ru, primary_muscle)')
        .single();
      if (error) throw error;
      onUpdate(data);
      setEditing(false);
    } catch (e) { console.error(e); alert('Ошибка сохранения'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить подход #${index + 1}?`)) return;
    const { error } = await supabase
      .from('sets')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', set.id);
    if (error) { alert('Ошибка удаления'); return; }
    onDelete(set.id);
  }

  const vol = Math.round((parseFloat(set.weight_kg) || 0) * (set.reps || 0));

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-dark-elevated border border-primary-500/40">
        <span className="text-xs font-mono text-dark-muted w-6 flex-shrink-0">#{index + 1}</span>
        <input type="number" inputMode="decimal" step="0.5"
          value={draft.weight_kg} onChange={e => setDraft(p => ({ ...p, weight_kg: e.target.value }))}
          className="input-field w-20 text-sm py-1 px-2" placeholder="кг" />
        <span className="text-dark-muted text-xs">×</span>
        <input type="number" inputMode="numeric"
          value={draft.reps} onChange={e => setDraft(p => ({ ...p, reps: e.target.value }))}
          className="input-field w-16 text-sm py-1 px-2" placeholder="повт" />
        <input type="number" inputMode="decimal" step="0.5" min="1" max="10"
          value={draft.rpe} onChange={e => setDraft(p => ({ ...p, rpe: e.target.value }))}
          className="input-field w-16 text-sm py-1 px-2" placeholder="RPE" />
        <button onClick={saveEdit} disabled={saving}
          className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 flex-shrink-0">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)}
          className="p-1.5 rounded-lg bg-dark-border text-dark-muted hover:bg-dark-elevated flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-dark-elevated border border-dark-border group">
      <span className="text-xs font-mono text-dark-muted w-6 flex-shrink-0">#{index + 1}</span>
      <div className="flex-1">
        <span className="font-semibold text-sm">{set.weight_kg} кг × {set.reps}</span>
        {set.rpe && <span className="text-xs text-dark-muted ml-2">RPE {set.rpe}</span>}
      </div>
      <span className="text-xs text-dark-muted">{vol} кг</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg hover:bg-dark-border text-dark-muted hover:text-dark-text transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleDelete}
          className="p-1.5 rounded-lg hover:bg-red-500/15 text-dark-muted hover:text-red-400 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExerciseAccordion — одна карточка упражнения
// ─────────────────────────────────────────────────────────────────────────────
function ExerciseAccordion({ exercise, isActive, sets, onSetAdded, onSetUpdated, onSetDeleted, workoutRef, workoutCreatingRef, onWorkoutCreated }) {
  const [open, setOpen] = useState(isActive);
  const [showHistory, setShowHistory] = useState(false);

  // Форма
  const [quickSet, setQuickSet] = useState({ weight_kg: '', reps: '', rpe: '' });
  const [adding, setAdding] = useState(false);

  // История
  const [pastHistory, setPastHistory] = useState(null); // { date, sets[] }
  const [fullHistory, setFullHistory] = useState({});   // { date: sets[] }
  const [loadingHistory, setLoadingHistory] = useState(false);

  const exerciseSets = useMemo(
    () => sets.filter(s => s.exercise_id === exercise.id),
    [sets, exercise.id]
  );

  const lastSet = exerciseSets.at(-1) ?? null;

  const canChangeWeight =
    parseNum(quickSet.weight_kg) !== null || parseNum(lastSet?.weight_kg) !== null;

  // ── Открываем/закрываем при isActive ──────────────────────────────────────
  useEffect(() => { if (isActive) setOpen(true); }, [isActive]);

  // ── Загрузка истории при открытии ─────────────────────────────────────────
  // ИСПРАВЛЕНИЕ: запрашиваем sets напрямую, не exercise_progress
  // Не используем order по вложенной таблице — сортируем в JS
  useEffect(() => {
    if (!open || pastHistory !== null) return; // уже загружено или закрыто

    let cancelled = false;
    setLoadingHistory(true);

    async function load() {
      try {
        // Шаг 1: получаем все workout_id для этого упражнения (последние тренировки)
        const { data: rawSets, error } = await supabase
          .from('sets')
          .select('weight_kg, reps, rpe, set_order, workout_id')
          .eq('exercise_id', exercise.id)
          .eq('is_deleted', false)
          .eq('is_warmup', false)
          .order('set_order', { ascending: true })
          .limit(200);

        if (error) throw error;
        if (cancelled || !rawSets?.length) {
          if (!cancelled) { setPastHistory(null); setLoadingHistory(false); }
          return;
        }

        // Шаг 2: получаем даты тренировок
        const workoutIds = [...new Set(rawSets.map(s => s.workout_id))];
        const { data: workoutsData, error: wErr } = await supabase
          .from('workouts')
          .select('id, workout_date')
          .in('id', workoutIds)
          .eq('is_deleted', false)
          .order('workout_date', { ascending: false });

        if (wErr) throw wErr;
        if (cancelled) return;

        // Шаг 3: создаём map workout_id → date
        const wMap = {};
        (workoutsData || []).forEach(w => { wMap[w.id] = w.workout_date; });

        // Шаг 4: группируем подходы по дате
        const grouped = {};
        rawSets.forEach(s => {
          const d = wMap[s.workout_id];
          if (!d) return; // тренировка is_deleted — пропускаем
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push({
            weight_kg: parseFloat(s.weight_kg),
            reps: s.reps,
            rpe: s.rpe,
          });
        });

        setFullHistory(grouped);

        // Шаг 5: последняя дата (кроме текущей тренировки если workout уже создан)
        const today = new Date().toISOString().split('T')[0];
        const currentWorkoutId = workoutRef.current?.id;
        const datesDesc = Object.keys(grouped).sort().reverse();

        // Исключаем сегодняшнюю только если она совпадает с текущей тренировкой
        const lastDate = datesDesc.find(d => {
          if (d !== today) return true;
          // Если сегодня — проверяем, это текущая тренировка или нет
          // Если текущей тренировки нет ещё, то сегодняшняя = прошлая
          return !currentWorkoutId;
        }) || datesDesc[0];

        const historySets = grouped[lastDate] || [];

        if (!cancelled) {
          setPastHistory(historySets.length ? { date: lastDate, sets: historySets } : null);

          // Автозаполнение первого подхода
          if (historySets.length && exerciseSets.length === 0) {
            const first = historySets[0];
            setQuickSet({
              weight_kg: formatWeightValue(first.weight_kg),
              reps: String(first.reps),
              rpe: first.rpe != null ? String(first.rpe) : '',
            });
          }
        }
      } catch (e) {
        console.error('History load error:', e);
        if (!cancelled) setPastHistory(null);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open, exercise.id]); // eslint-disable-line

  // ── Автозаполнение следующего подхода после добавления ────────────────────
  function prefillNext(newCount) {
    if (!pastHistory?.sets) return;
    const next = pastHistory.sets[newCount];
    if (next) {
      setQuickSet({
        weight_kg: formatWeightValue(next.weight_kg),
        reps: String(next.reps),
        rpe: next.rpe != null ? String(next.rpe) : '',
      });
    } else {
      setQuickSet(p => ({ ...p, reps: '', rpe: '' }));
    }
  }

  function adjustWeight(mult) {
    const next = applyWeightChange({
      currentWeight: quickSet.weight_kg,
      fallbackWeight: lastSet?.weight_kg,
      multiplier: mult,
    });
    if (next) setQuickSet(p => ({ ...p, weight_kg: next }));
  }

  async function ensureWorkout() {
    if (workoutRef.current) return workoutRef.current;
    if (workoutCreatingRef.current) {
      // Ждём пока создастся
      await new Promise(res => setTimeout(res, 800));
      return workoutRef.current;
    }
    workoutCreatingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: SINGLE_USER_ID,
          workout_date: new Date().toISOString().split('T')[0],
          start_time: new Date().toISOString(),
        }).select().single();
      if (error) throw error;
      onWorkoutCreated(data);
      workoutRef.current = data;
      return data;
    } catch (e) {
      console.error(e);
      alert('Ошибка создания тренировки');
      return null;
    } finally { workoutCreatingRef.current = false; }
  }

  async function addSet() {
    const weight = parseNum(quickSet.weight_kg);
    const reps = parseInt(quickSet.reps, 10);
    const rpe = parseNum(quickSet.rpe);

    if (!quickSet.weight_kg || !quickSet.reps) { alert('Заполни вес и повторения'); return; }
    if (weight === null || weight < 0) { alert('Вес ≥ 0 кг'); return; }
    if (isNaN(reps) || reps < 1) { alert('Повторений ≥ 1'); return; }
    if (rpe !== null && (rpe < 1 || rpe > 10)) { alert('RPE от 1 до 10'); return; }

    const w = await ensureWorkout();
    if (!w) return;

    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('sets')
        .insert({
          workout_id: w.id,
          exercise_id: exercise.id,
          set_order: exerciseSets.length + 1,
          weight_kg: weight, reps,
          rpe: rpe && rpe > 0 ? rpe : null,
        })
        .select('*, exercises(name_ru, primary_muscle)')
        .single();
      if (error) throw error;
      onSetAdded(data);
      prefillNext(exerciseSets.length + 1);
    } catch (e) {
      console.error(e);
      alert('Ошибка добавления подхода');
    } finally { setAdding(false); }
  }

  const exVol = Math.round(
    exerciseSets.reduce((s, x) => s + (parseFloat(x.weight_kg) || 0) * (x.reps || 0), 0)
  );

  const showBanner = pastHistory && !loadingHistory && exerciseSets.length < (pastHistory.sets?.length ?? 0);

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden
      ${open
        ? 'border-primary-500/40 bg-dark-surface shadow-lg shadow-primary-900/20'
        : 'border-dark-border bg-dark-surface hover:border-dark-muted/40'
      }`}
    >
      {/* ── Заголовок аккордеона ── */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
          ${open ? 'bg-primary-600/20' : 'bg-dark-elevated'}`}>
          <Dumbbell className={`w-4.5 h-4.5 ${open ? 'text-primary-400' : 'text-dark-muted'}`} style={{ width: '1.125rem', height: '1.125rem' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold truncate ${open ? 'text-dark-text' : 'text-dark-muted'}`}>
            {exercise.name_ru}
          </p>
          <p className="text-xs text-dark-muted truncate">
            {exercise.primary_muscle}
            {exerciseSets.length > 0 && (
              <span className="ml-2 text-primary-400">
                · {exerciseSets.length} подх. · {fmtVol(exVol)}
              </span>
            )}
          </p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-dark-muted flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-dark-muted flex-shrink-0" />
        }
      </button>

      {/* ── Тело аккордеона ── */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-dark-border/50 pt-3">

          {/* Баннер истории */}
          {loadingHistory && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-elevated">
              <div className="w-3 h-3 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
              <span className="text-xs text-dark-muted">Загружаем историю...</span>
            </div>
          )}
          {showBanner && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600/10 border border-primary-600/20">
              <Clock className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
              <p className="text-xs text-primary-300 flex-1">
                Из тренировки
                <span className="font-medium text-primary-200">
                  {' '}{format(parseISO(pastHistory.date), 'd MMMM', { locale: ru })}
                </span>
                <span className="text-primary-400">
                  {' '}· подход {exerciseSets.length + 1} из {pastHistory.sets.length}
                </span>
              </p>
            </div>
          )}

          {/* Кнопки ±% и Повторить */}
          <div className="flex gap-2 flex-wrap">
            {lastSet && (
              <button type="button" onClick={() => setQuickSet({
                weight_kg: formatWeightValue(lastSet.weight_kg),
                reps: String(lastSet.reps),
                rpe: lastSet.rpe != null ? String(lastSet.rpe) : '',
              })}
                className="btn-secondary text-xs px-3 py-1.5">
                Повторить
              </button>
            )}
            <button type="button" onClick={() => adjustWeight(1.05)} disabled={!canChangeWeight}
              className="btn-secondary text-xs px-3 py-1.5">+5%</button>
            <button type="button" onClick={() => adjustWeight(0.95)} disabled={!canChangeWeight}
              className="btn-secondary text-xs px-3 py-1.5">−5%</button>
            {/* Кнопка показать историю */}
            {Object.keys(fullHistory).length > 0 && (
              <button type="button" onClick={() => setShowHistory(s => !s)}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 ml-auto">
                <History className="w-3.5 h-3.5" />
                {showHistory ? 'Скрыть' : 'История'}
              </button>
            )}
          </div>

          {/* Форма подхода */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-dark-muted mb-1 block">Вес, кг</label>
              <input type="number" inputMode="decimal" step="0.5" min="0"
                value={quickSet.weight_kg}
                onChange={e => setQuickSet(p => ({ ...p, weight_kg: e.target.value }))}
                className="input-field w-full" placeholder="100" />
            </div>
            <div>
              <label className="text-xs text-dark-muted mb-1 block">Повторения</label>
              <input type="number" inputMode="numeric" min="1"
                value={quickSet.reps}
                onChange={e => setQuickSet(p => ({ ...p, reps: e.target.value }))}
                className="input-field w-full" placeholder="10" />
            </div>
            <div>
              <label className="text-xs text-dark-muted mb-1 block">RPE</label>
              <input type="number" inputMode="decimal" step="0.5" min="1" max="10"
                value={quickSet.rpe}
                onChange={e => setQuickSet(p => ({ ...p, rpe: e.target.value }))}
                className="input-field w-full" placeholder="—" />
            </div>
          </div>

          <button onClick={addSet} disabled={adding}
            className="btn-primary w-full flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" />
            {adding ? 'Добавляем...' : `Подход ${exerciseSets.length + 1}`}
          </button>

          {/* Добавленные подходы */}
          {exerciseSets.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs text-dark-muted font-medium">Подходы</p>
              {exerciseSets.map((set, idx) => (
                <SetRow
                  key={set.id} set={set} index={idx}
                  onUpdate={updated => onSetUpdated(updated)}
                  onDelete={id => onSetDeleted(id)}
                />
              ))}
              <div className="text-right text-xs text-dark-muted pt-1">
                Объём упражнения: <span className="text-dark-text font-medium">{fmtVol(exVol)}</span>
              </div>
            </div>
          )}

          {/* История (раскрываемая) */}
          {showHistory && Object.keys(fullHistory).length > 0 && (
            <div className="pt-2 border-t border-dark-border/50">
              <p className="text-xs text-dark-muted font-medium mb-2">История упражнения</p>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {Object.keys(fullHistory).sort().reverse().map(date => (
                  <div key={date}>
                    <p className="text-xs text-dark-muted mb-1.5">
                      {format(parseISO(date), 'd MMMM yyyy', { locale: ru })}
                    </p>
                    <div className="space-y-1">
                      {fullHistory[date].map((s, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-elevated text-sm">
                          <span className="text-xs text-dark-muted w-5">#{i + 1}</span>
                          <span className="flex-1 font-medium">{s.weight_kg} кг × {s.reps}</span>
                          {s.rpe && <span className="text-xs text-dark-muted">RPE {s.rpe}</span>}
                          <button
                            onClick={() => {
                              setQuickSet({
                                weight_kg: formatWeightValue(s.weight_kg),
                                reps: String(s.reps),
                                rpe: s.rpe != null ? String(s.rpe) : '',
                              });
                            }}
                            className="text-xs text-primary-400 hover:text-primary-300 transition-colors px-1"
                          >
                            ↑ вставить
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ГЛАВНЫЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────
export default function LogWorkoutPage() {
  const navigate = useNavigate();

  const [workout, setWorkout] = useState(null);
  const workoutRef = useRef(null);
  const workoutCreatingRef = useRef(false);

  const [exercises, setExercises] = useState([]);
  const [workoutExercises, setWorkoutExercises] = useState([]); // [{id, name_ru, ...}]
  const [activeExerciseId, setActiveExerciseId] = useState(null); // последнее добавленное
  const [sets, setSets] = useState([]);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [finishingWorkout, setFinishingWorkout] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);

  // Sync workout ref
  useEffect(() => { workoutRef.current = workout; }, [workout]);

  // Cleanup: soft-delete если ушли без подходов
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
              .eq('id', w.id).then(() => { });
          }
        });
    };
  }, []);

  async function loadExercises() {
    const { data } = await supabase
      .from('exercises').select('*').eq('is_deleted', false).order('name_ru');
    if (data) setExercises(data);
  }

  function handleWorkoutCreated(w) {
    setWorkout(w);
    workoutRef.current = w;
  }

  function handleSetAdded(set) {
    setSets(prev => [...prev, set]);
    // Добавляем упражнение в список если ещё нет
    if (!workoutExercises.find(e => e.id === set.exercise_id)) {
      const ex = exercises.find(e => e.id === set.exercise_id);
      if (ex) setWorkoutExercises(prev => [...prev, ex]);
    }
  }

  function handleSetUpdated(updated) {
    setSets(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  function handleSetDeleted(id) {
    setSets(prev => prev.filter(s => s.id !== id));
  }

  function pickExercise(exercise) {
    // Если уже добавлено — просто разворачиваем
    if (workoutExercises.find(e => e.id === exercise.id)) {
      setActiveExerciseId(exercise.id);
      setShowPicker(false);
      setPickerSearch('');
      return;
    }
    // Новое упражнение
    setWorkoutExercises(prev => [...prev, exercise]);
    setActiveExerciseId(exercise.id);
    setShowPicker(false);
    setPickerSearch('');
  }

  async function finishWorkout() {
    if (finishingWorkout) return;
    if (sets.length === 0) { navigate('/'); return; }
    if (!workout?.id) return;
    try {
      setFinishingWorkout(true);
      await supabase.from('workouts')
        .update({ end_time: new Date().toISOString() }).eq('id', workout.id);
      let summary;
      try {
        summary = await requestSessionSummary({
          workoutId: workout.id,
          recentSets: sets.map(s => ({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe })),
        });
      } catch {
        summary = {
          summary: `Хорошая тренировка! ${sets.length} подходов, ${fmtVol(totalVolume)} объёма.`,
          highlights: [`Упражнений: ${workoutExercises.length}`, `Подходов: ${sets.length}`],
          suggestions: [],
        };
      }
      setSessionSummary(summary);
      setShowSummaryModal(true);
    } catch (e) {
      console.error(e);
      alert('Ошибка завершения тренировки');
    } finally { setFinishingWorkout(false); }
  }

  const totalVolume = Math.round(
    sets.reduce((s, x) => s + (parseFloat(x.weight_kg) || 0) * (x.reps || 0), 0)
  );

  const filteredExercises = exercises.filter(e =>
    e.name_ru?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    e.primary_muscle?.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-dark-bg pb-24">

      {/* ── Header ── */}
      <div className="bg-dark-surface border-b border-dark-border p-4 safe-top sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">Новая тренировка</h1>
            {sets.length > 0 && (
              <p className="text-xs text-dark-muted mt-0.5">
                {workoutExercises.length} упр. · {sets.length} подх. · {fmtVol(totalVolume)}
              </p>
            )}
          </div>
          <button
            onClick={() => { setPickerSearch(''); setShowPicker(true); }}
            className="flex items-center gap-1.5 bg-dark-elevated border border-dark-border
                       text-sm font-medium px-3 py-2 rounded-xl
                       hover:border-primary-500/50 hover:text-primary-400 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4 text-primary-500" />
            <span className="hidden sm:inline">Упражнение</span>
          </button>
          <button
            onClick={finishWorkout}
            disabled={finishingWorkout}
            className="btn-primary flex items-center gap-1.5 flex-shrink-0"
          >
            <Save className="w-4 h-4" />
            {finishingWorkout ? 'Завершение...' : sets.length === 0 ? 'Отмена' : 'Завершить'}
          </button>
        </div>
      </div>

      {/* ── Список упражнений (аккордеоны) ── */}
      <div className="p-4 space-y-3">
        {workoutExercises.length === 0 ? (
          /* Стартовый экран */
          <button
            onClick={() => { setPickerSearch(''); setShowPicker(true); }}
            className="w-full card-elevated py-12 text-center hover:border-primary-500/40 transition-all"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary-600/15 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-8 h-8 text-primary-400" />
            </div>
            <p className="font-semibold text-lg">Начать тренировку</p>
            <p className="text-sm text-dark-muted mt-1">Выберите первое упражнение</p>
          </button>
        ) : (
          workoutExercises.map(exercise => (
            <ExerciseAccordion
              key={exercise.id}
              exercise={exercise}
              isActive={exercise.id === activeExerciseId}
              sets={sets}
              onSetAdded={handleSetAdded}
              onSetUpdated={handleSetUpdated}
              onSetDeleted={handleSetDeleted}
              workoutRef={workoutRef}
              workoutCreatingRef={workoutCreatingRef}
              onWorkoutCreated={handleWorkoutCreated}
            />
          ))
        )}

        {/* Кнопка добавить упражнение внизу списка */}
        {workoutExercises.length > 0 && (
          <button
            onClick={() => { setPickerSearch(''); setShowPicker(true); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                       border border-dashed border-dark-border text-dark-muted text-sm
                       hover:border-primary-500/40 hover:text-primary-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить упражнение
          </button>
        )}
      </div>

      {/* ── Пикер упражнений ── */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-lg sm:rounded-2xl max-h-[85vh] flex flex-col rounded-t-2xl overflow-hidden">
            <div className="p-4 border-b border-dark-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Выбрать упражнение</h2>
                <button onClick={() => setShowPicker(false)} className="p-2 text-dark-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Поиск */}
              <input
                type="text"
                autoFocus
                placeholder="Поиск..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-1">
              {filteredExercises.length === 0 && (
                <p className="text-center text-dark-muted py-8 text-sm">Ничего не найдено</p>
              )}
              {filteredExercises.map(exercise => {
                const already = workoutExercises.some(e => e.id === exercise.id);
                return (
                  <button
                    key={exercise.id}
                    onClick={() => pickExercise(exercise)}
                    className={`w-full text-left py-3 px-3 rounded-xl transition-colors
                      ${already
                        ? 'bg-primary-600/10 border border-primary-600/20'
                        : 'hover:bg-dark-elevated'}`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-medium flex-1">{exercise.name_ru}</p>
                      {already && (
                        <span className="text-xs text-primary-400 font-medium">в тренировке</span>
                      )}
                    </div>
                    <p className="text-xs text-dark-muted">{exercise.primary_muscle}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Итог тренировки ── */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-xl sm:rounded-2xl border border-dark-border overflow-hidden rounded-t-2xl">
            <div className="p-4 border-b border-dark-border">
              <h2 className="text-lg font-semibold">Тренировка завершена 🏋️</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  [sets.length, 'подходов'],
                  [workoutExercises.length, 'упражнений'],
                  [fmtVol(totalVolume), 'объём'],
                ].map(([v, l]) => (
                  <div key={l} className="bg-dark-elevated rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{v}</p>
                    <p className="text-xs text-dark-muted">{l}</p>
                  </div>
                ))}
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
                  <Save className="w-4 h-4" />Сохранить как шаблон
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

      {/* ── Шаблон ── */}
      {showTemplateModal && (
        <SaveTemplateModal
          exercises={workoutExercises}
          sets={sets}
          onSave={() => { setShowTemplateModal(false); navigate(`/workouts/${workout.id}`); }}
          onSkip={() => { setShowTemplateModal(false); navigate(`/workouts/${workout.id}`); }}
        />
      )}
    </div>
  );
}

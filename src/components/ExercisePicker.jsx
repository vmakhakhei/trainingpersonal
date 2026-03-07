// src/components/ExercisePicker.jsx
// Переиспользуемый пикер упражнений с поиском, фильтрами по мышцам и группировкой
import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronRight, Check } from 'lucide-react';

// ─── Словари ─────────────────────────────────────────────────────────────────
const MUSCLE_LABELS = {
  back:      'Спина',
  chest:     'Грудь',
  legs:      'Ноги',
  arms:      'Руки',
  shoulders: 'Плечи',
  core:      'Корпус',
  glutes:    'Ягодицы',
  cardio:    'Кардио',
};

const MUSCLE_EMOJI = {
  back:      '🔙',
  chest:     '💪',
  legs:      '🦵',
  arms:      '💪',
  shoulders: '🏋️',
  core:      '🎯',
  glutes:    '🍑',
  cardio:    '🏃',
};

const EQUIPMENT_LABELS = {
  barbell:    'Штанга',
  dumbbell:   'Гантели',
  cable:      'Блок',
  machine:    'Тренажёр',
  bodyweight: 'Своё тело',
  kettlebell: 'Гиря',
  band:       'Резина',
};

const EQUIPMENT_COLORS = {
  barbell:    'bg-orange-500/15 text-orange-300',
  dumbbell:   'bg-blue-500/15 text-blue-300',
  cable:      'bg-purple-500/15 text-purple-300',
  machine:    'bg-yellow-500/15 text-yellow-300',
  bodyweight: 'bg-green-500/15 text-green-300',
  kettlebell: 'bg-red-500/15 text-red-300',
  band:       'bg-pink-500/15 text-pink-300',
};

function muscleLabel(key) {
  return MUSCLE_LABELS[key] || key;
}
function equipmentLabel(key) {
  return EQUIPMENT_LABELS[key] || key;
}

// ─── ExercisePicker ───────────────────────────────────────────────────────────
/**
 * Props:
 *   exercises        – массив всех упражнений из БД
 *   onSelect(ex)     – колбэк при выборе
 *   onClose()        – колбэк при закрытии
 *   selectedIds      – Set<string> уже добавленных упражнений (для пометки "в тренировке")
 *   title            – заголовок шторки (default: "Выбрать упражнение")
 *   multiSelect      – режим множественного выбора (для будущих экранов)
 *   onConfirmMulti   – колбэк для множественного выбора (массив)
 */
export default function ExercisePicker({
  exercises = [],
  onSelect,
  onClose,
  selectedIds = new Set(),
  title = 'Выбрать упражнение',
  multiSelect = false,
  onConfirmMulti,
}) {
  const [search, setSearch]             = useState('');
  const [activeMuscle, setActiveMuscle] = useState(null); // null = все
  const [multiPicked, setMultiPicked]   = useState(new Set());
  const searchRef = useRef(null);

  // Автофокус
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // Уникальные группы мышц из данных
  const muscleGroups = useMemo(() => {
    const seen = new Set();
    exercises.forEach(e => { if (e.primary_muscle) seen.add(e.primary_muscle); });
    return [...seen].sort((a, b) => muscleLabel(a).localeCompare(muscleLabel(b), 'ru'));
  }, [exercises]);

  // Фильтрация
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter(ex => {
      const matchesMuscle = !activeMuscle || ex.primary_muscle === activeMuscle;
      const matchesSearch = !q
        || ex.name_ru?.toLowerCase().includes(q)
        || ex.primary_muscle?.toLowerCase().includes(q)
        || muscleLabel(ex.primary_muscle).toLowerCase().includes(q)
        || ex.equipment?.toLowerCase().includes(q)
        || equipmentLabel(ex.equipment).toLowerCase().includes(q);
      return matchesMuscle && matchesSearch;
    });
  }, [exercises, search, activeMuscle]);

  // Группировка по мышцам (только если нет поискового запроса и нет фильтра)
  const grouped = useMemo(() => {
    if (search.trim() || activeMuscle) {
      // Плоский список при поиске/фильтре
      return [{ key: '__flat', label: null, items: filtered }];
    }
    const map = {};
    filtered.forEach(ex => {
      const g = ex.primary_muscle || 'other';
      if (!map[g]) map[g] = [];
      map[g].push(ex);
    });
    return Object.entries(map)
      .sort(([a], [b]) => muscleLabel(a).localeCompare(muscleLabel(b), 'ru'))
      .map(([key, items]) => ({ key, label: muscleLabel(key), emoji: MUSCLE_EMOJI[key], items }));
  }, [filtered, search, activeMuscle]);

  function toggleMulti(ex) {
    setMultiPicked(prev => {
      const next = new Set(prev);
      next.has(ex.id) ? next.delete(ex.id) : next.add(ex.id);
      return next;
    });
  }

  function handleSelect(ex) {
    if (multiSelect) {
      toggleMulti(ex);
    } else {
      onSelect(ex);
    }
  }

  function handleConfirmMulti() {
    const picked = exercises.filter(e => multiPicked.has(e.id));
    onConfirmMulti?.(picked);
  }

  const totalResults = filtered.length;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <div
        className="bg-dark-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl
                   max-h-[90vh] flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(90vh, 680px)' }}
      >
        {/* ── Шапка ── */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          {/* Handle */}
          <div className="w-10 h-1 bg-dark-border rounded-full mx-auto mb-4 sm:hidden" />

          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">{title}</h2>
            <button onClick={onClose} className="p-1.5 text-dark-muted hover:text-dark-text
                                                  rounded-lg hover:bg-dark-elevated transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Строка поиска */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию или мышце..."
              className="input-field w-full pl-9 pr-8"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Чипсы мышечных групп */}
          {muscleGroups.length > 1 && (
            <div className="flex gap-2 mt-2.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => setActiveMuscle(null)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all
                  ${!activeMuscle
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-elevated text-dark-muted hover:text-dark-text border border-dark-border'
                  }`}
              >
                Все
              </button>
              {muscleGroups.map(mg => (
                <button
                  key={mg}
                  onClick={() => setActiveMuscle(activeMuscle === mg ? null : mg)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all
                    ${activeMuscle === mg
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-elevated text-dark-muted hover:text-dark-text border border-dark-border'
                    }`}
                >
                  <span>{MUSCLE_EMOJI[mg]}</span>
                  <span>{muscleLabel(mg)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Счётчик результатов */}
          {(search || activeMuscle) && (
            <p className="text-xs text-dark-muted mt-2">
              {totalResults === 0
                ? 'Ничего не найдено'
                : `${totalResults} упражн${totalResults === 1 ? 'ение' : totalResults < 5 ? 'ения' : 'ений'}`
              }
            </p>
          )}
        </div>

        {/* ── Список ── */}
        <div className="overflow-y-auto flex-1 px-3 pb-3 space-y-1">
          {totalResults === 0 ? (
            <div className="text-center py-12">
              <p className="text-dark-muted text-sm">Ничего не найдено</p>
              <button
                onClick={() => { setSearch(''); setActiveMuscle(null); }}
                className="text-primary-400 text-xs mt-2 hover:text-primary-300 transition-colors"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.key}>
                {/* Заголовок группы */}
                {group.label && (
                  <div className="flex items-center gap-2 px-2 py-2 mt-2 first:mt-0">
                    <span className="text-base leading-none">{group.emoji}</span>
                    <span className="text-xs font-semibold text-dark-muted uppercase tracking-wide">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-dark-border" />
                    <span className="text-xs text-dark-muted">{group.items.length}</span>
                  </div>
                )}

                {/* Упражнения группы */}
                <div className="space-y-0.5">
                  {group.items.map(exercise => {
                    const inWorkout  = selectedIds.has(exercise.id);
                    const inMulti    = multiPicked.has(exercise.id);

                    return (
                      <button
                        key={exercise.id}
                        onClick={() => handleSelect(exercise)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all
                          ${inWorkout && !multiSelect
                            ? 'bg-primary-600/10 border border-primary-600/20'
                            : inMulti
                              ? 'bg-primary-600/15 border border-primary-500/40'
                              : 'hover:bg-dark-elevated border border-transparent'
                          }`}
                      >
                        {/* Иконка выбора (мультиселект) или чекмарк (уже в тренировке) */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                          ${inMulti
                            ? 'bg-primary-600 text-white'
                            : inWorkout && !multiSelect
                              ? 'bg-primary-600/20'
                              : 'bg-dark-elevated'
                          }`}
                        >
                          {inMulti ? (
                            <Check className="w-4 h-4" />
                          ) : inWorkout && !multiSelect ? (
                            <Check className="w-4 h-4 text-primary-400" />
                          ) : (
                            <span className="text-sm leading-none">
                              {MUSCLE_EMOJI[exercise.primary_muscle] || '🏋️'}
                            </span>
                          )}
                        </div>

                        {/* Название + мышца */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm leading-tight truncate
                            ${inWorkout && !multiSelect ? 'text-primary-200' : ''}`}>
                            {exercise.name_ru}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-dark-muted">
                              {muscleLabel(exercise.primary_muscle)}
                            </span>
                            {exercise.equipment && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium
                                ${EQUIPMENT_COLORS[exercise.equipment] || 'bg-dark-elevated text-dark-muted'}`}>
                                {equipmentLabel(exercise.equipment)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Правый индикатор */}
                        {inWorkout && !multiSelect ? (
                          <span className="text-xs text-primary-400 font-medium flex-shrink-0">
                            в тренировке
                          </span>
                        ) : !multiSelect ? (
                          <ChevronRight className="w-4 h-4 text-dark-muted flex-shrink-0 opacity-50" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Кнопка подтверждения (мультиселект) ── */}
        {multiSelect && multiPicked.size > 0 && (
          <div className="px-4 pb-5 pt-2 border-t border-dark-border flex-shrink-0">
            <button
              onClick={handleConfirmMulti}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Добавить {multiPicked.size} упражн{multiPicked.size === 1 ? 'ение' : multiPicked.size < 5 ? 'ения' : 'ений'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

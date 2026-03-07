// src/components/ExercisePicker.jsx
// Зависимость: npm install react-body-highlighter
import { useState, useMemo, useRef, useEffect } from 'react';
import Model from 'react-body-highlighter';
import { Search, X, ChevronRight, Check, RotateCcw } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Маппинг: наши slug из БД → slug библиотеки react-body-highlighter
// Библиотека: chest | biceps | triceps | forearm | front-deltoids | back-deltoids
//             abs | obliques | trapezius | upper-back | lower-back
//             quadriceps | hamstring | gluteal | calves | adductor | abductors
// ─────────────────────────────────────────────────────────────────────────────
const MUSCLE_DETAIL_TO_LIB = {
  // Грудь
  chest_upper:       ['chest'],
  chest_mid:         ['chest'],
  chest_lower:       ['chest'],
  // Спина
  back_lats:         ['upper-back'],
  back_traps:        ['trapezius'],
  back_rhomb:        ['upper-back'],
  back_lower:        ['lower-back'],
  // Плечи
  shoulders_front:   ['front-deltoids'],
  shoulders_mid:     ['front-deltoids', 'back-deltoids'],
  shoulders_rear:    ['back-deltoids'],
  // Руки
  arms_bicep:        ['biceps'],
  arms_tricep:       ['triceps'],
  arms_forearm:      ['forearm'],
  // Ноги
  legs_quad:         ['quadriceps'],
  legs_hamstr:       ['hamstring'],
  legs_glutes:       ['gluteal'],
  legs_calves:       ['calves'],
  // Кор
  core_abs:          ['abs'],
  core_obliq:        ['obliques'],
  core_lower:        ['lower-back'],
  // Ягодицы
  glutes_max:        ['gluteal'],
  glutes_med:        ['gluteal', 'abductors'],
};

// Обратный маппинг: lib slug → наши primary_muscle (для фильтрации списка)
const LIB_TO_PRIMARY = {
  'chest':          ['chest'],
  'biceps':         ['arms'],
  'triceps':        ['arms'],
  'forearm':        ['arms'],
  'front-deltoids': ['shoulders'],
  'back-deltoids':  ['shoulders'],
  'abs':            ['core'],
  'obliques':       ['core'],
  'trapezius':      ['back'],
  'upper-back':     ['back'],
  'lower-back':     ['back', 'core'],
  'quadriceps':     ['legs'],
  'hamstring':      ['legs'],
  'gluteal':        ['legs', 'glutes'],
  'calves':         ['legs'],
  'adductor':       ['legs'],
  'abductors':      ['legs', 'glutes'],
};

// Обратный маппинг: lib slug → наши muscle_detail (для фильтрации по подгруппе)
const LIB_TO_DETAIL = {
  'chest':          ['chest_upper','chest_mid','chest_lower'],
  'biceps':         ['arms_bicep'],
  'triceps':        ['arms_tricep'],
  'forearm':        ['arms_forearm'],
  'front-deltoids': ['shoulders_front','shoulders_mid'],
  'back-deltoids':  ['shoulders_rear','shoulders_mid'],
  'abs':            ['core_abs'],
  'obliques':       ['core_obliq'],
  'trapezius':      ['back_traps'],
  'upper-back':     ['back_lats','back_rhomb'],
  'lower-back':     ['back_lower','core_lower'],
  'quadriceps':     ['legs_quad'],
  'hamstring':      ['legs_hamstr'],
  'gluteal':        ['legs_glutes','glutes_max','glutes_med'],
  'calves':         ['legs_calves'],
  'adductor':       ['legs_quad'],
  'abductors':      ['glutes_med'],
};

// Русские названия мышц библиотеки для отображения в UI
const LIB_MUSCLE_RU = {
  'chest':          'Грудь',
  'biceps':         'Бицепс',
  'triceps':        'Трицепс',
  'forearm':        'Предплечье',
  'front-deltoids': 'Передняя дельта',
  'back-deltoids':  'Задняя дельта',
  'abs':            'Пресс',
  'obliques':       'Косые',
  'trapezius':      'Трапеция',
  'upper-back':     'Верхняя спина',
  'lower-back':     'Поясница',
  'quadriceps':     'Квадрицепс',
  'hamstring':      'Бицепс бедра',
  'gluteal':        'Ягодицы',
  'calves':         'Икры',
  'adductor':       'Приводящие',
  'abductors':      'Отводящие',
  'head':           null,
  'neck':           null,
};

// Цвета для подсветки (интенсивность 1 = есть упражнения, 2 = активная мышца)
const HIGHLIGHT_COLORS = ['#0d9488cc', '#14b8a6'];  // teal-600, teal-500
const ACTIVE_COLORS    = ['#f59e0b',   '#fbbf24'];  // amber активная мышца

const EQUIPMENT_LABELS = {
  barbell: 'Штанга', dumbbell: 'Гантели', cable: 'Блок',
  machine: 'Тренажёр', bodyweight: 'Тело', kettlebell: 'Гиря', band: 'Резина',
};
const EQUIPMENT_COLORS = {
  barbell:    'bg-orange-500/15 text-orange-300 border-orange-500/20',
  dumbbell:   'bg-blue-500/15 text-blue-300 border-blue-500/20',
  cable:      'bg-purple-500/15 text-purple-300 border-purple-500/20',
  machine:    'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  bodyweight: 'bg-green-500/15 text-green-300 border-green-500/20',
  kettlebell: 'bg-red-500/15 text-red-300 border-red-500/20',
  band:       'bg-pink-500/15 text-pink-300 border-pink-500/20',
};

// ─────────────────────────────────────────────────────────────────────────────
// Конвертируем упражнения из БД в формат библиотеки
// ─────────────────────────────────────────────────────────────────────────────
function exercisesToModelData(exercises) {
  return exercises.map(ex => {
    const detail = ex.muscle_detail;
    const libMuscles = detail && MUSCLE_DETAIL_TO_LIB[detail]
      ? MUSCLE_DETAIL_TO_LIB[detail]
      : (LIB_TO_PRIMARY[ex.primary_muscle] ? [ex.primary_muscle] : ['chest']);
    return { name: ex.name_ru, muscles: libMuscles };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ГЛАВНЫЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────
export default function ExercisePicker({
  exercises = [],
  onSelect,
  onClose,
  selectedIds = new Set(),
  title = 'Выбрать упражнение',
  multiSelect = false,
  onConfirmMulti,
}) {
  const [activeMuscle, setActiveMuscle] = useState(null); // lib slug
  const [search, setSearch]             = useState('');
  const [mode, setMode]                 = useState('body'); // 'body' | 'search'
  const [multiPicked, setMultiPicked]   = useState(new Set());
  const searchRef = useRef(null);

  useEffect(() => {
    if (mode === 'search') setTimeout(() => searchRef.current?.focus(), 100);
  }, [mode]);

  // ── Данные для Model (все упражнения → подсвечены по наличию) ──────────────
  const allModelData = useMemo(() => exercisesToModelData(exercises), [exercises]);

  // ── Данные для Model активной мышцы (ярко подсвечена) ─────────────────────
  const activeModelData = useMemo(() => {
    if (!activeMuscle) return allModelData;
    // Активная мышца — amber, остальные — teal (тусклее)
    return allModelData.map(ex => {
      const libMuscles = ex.muscles || [];
      if (libMuscles.includes(activeMuscle)) {
        return { ...ex, muscles: libMuscles }; // получит intensity 2 → amber
      }
      return ex;
    });
  }, [allModelData, activeMuscle]);

  // ── Обработчик клика по мышце ──────────────────────────────────────────────
  function handleMuscleClick({ muscle }) {
    if (!LIB_MUSCLE_RU[muscle]) return; // голова/шея — игнорируем
    setActiveMuscle(prev => prev === muscle ? null : muscle);
    setSearch('');
  }

  // ── Фильтрация списка упражнений ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = exercises;

    if (activeMuscle) {
      const allowedDetails  = LIB_TO_DETAIL[activeMuscle]  || [];
      const allowedPrimary  = LIB_TO_PRIMARY[activeMuscle] || [];
      list = list.filter(ex =>
        allowedDetails.includes(ex.muscle_detail) ||
        allowedPrimary.includes(ex.primary_muscle)
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(ex =>
        ex.name_ru?.toLowerCase().includes(q) ||
        ex.primary_muscle?.toLowerCase().includes(q) ||
        (EQUIPMENT_LABELS[ex.equipment] || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [exercises, activeMuscle, search]);

  function handleSelect(ex) {
    if (multiSelect) {
      setMultiPicked(prev => {
        const n = new Set(prev);
        n.has(ex.id) ? n.delete(ex.id) : n.add(ex.id);
        return n;
      });
    } else {
      onSelect(ex);
    }
  }

  const activeMuscleRu = activeMuscle ? LIB_MUSCLE_RU[activeMuscle] : null;

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center">
      <div
        className="bg-dark-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(94vh, 720px)' }}
      >

        {/* ── Шапка ── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2">
          <div className="w-10 h-1 bg-dark-border rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-semibold flex-1 text-base">{title}</h2>
            {/* Переключатель режима */}
            <div className="flex bg-dark-elevated rounded-lg p-0.5 border border-dark-border">
              <button
                onClick={() => setMode('body')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${mode === 'body' ? 'bg-primary-600 text-white' : 'text-dark-muted hover:text-dark-text'}`}
              >
                🫀 Тело
              </button>
              <button
                onClick={() => setMode('search')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${mode === 'search' ? 'bg-primary-600 text-white' : 'text-dark-muted hover:text-dark-text'}`}
              >
                🔍 Поиск
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-dark-muted hover:text-dark-text rounded-lg hover:bg-dark-elevated transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── РЕЖИМ ТЕЛО ── */}
          {mode === 'body' && (
            <div>
              {/* Подсказка / активный фильтр */}
              <div className="flex items-center gap-2 min-h-[28px] mb-1">
                {activeMuscle ? (
                  <>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      {activeMuscleRu}
                    </span>
                    <span className="text-xs text-dark-muted">· {filtered.length} упр.</span>
                    <button
                      onClick={() => setActiveMuscle(null)}
                      className="ml-auto flex items-center gap-1 text-xs text-dark-muted hover:text-primary-400 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Сбросить
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-dark-muted">
                    Нажми на мышцу чтобы найти упражнения
                  </p>
                )}
              </div>

              {/* Два вида тела рядом */}
              <div className="flex gap-1 justify-center items-start">
                {/* Передний вид */}
                <div className="flex-1 flex flex-col items-center">
                  <p className="text-[10px] text-dark-muted mb-1 tracking-wide uppercase">Перёд</p>
                  <div
                    className="w-full"
                    style={{ maxWidth: 160 }}
                  >
                    <Model
                      data={activeModelData}
                      style={{ width: '100%' }}
                      type="anterior"
                      bodyColor="#1e1e2e"
                      highlightedColors={
                        activeMuscle
                          ? ['#0d948855', ACTIVE_COLORS[0]]
                          : HIGHLIGHT_COLORS
                      }
                      onClick={handleMuscleClick}
                    />
                  </div>
                </div>

                {/* Задний вид */}
                <div className="flex-1 flex flex-col items-center">
                  <p className="text-[10px] text-dark-muted mb-1 tracking-wide uppercase">Зад</p>
                  <div
                    className="w-full"
                    style={{ maxWidth: 160 }}
                  >
                    <Model
                      data={activeModelData}
                      style={{ width: '100%' }}
                      type="posterior"
                      bodyColor="#1e1e2e"
                      highlightedColors={
                        activeMuscle
                          ? ['#0d948855', ACTIVE_COLORS[0]]
                          : HIGHLIGHT_COLORS
                      }
                      onClick={handleMuscleClick}
                    />
                  </div>
                </div>
              </div>

              {/* CSS для hover эффекта */}
              <style>{`
                .rbh polygon, .rbh path, .rbh rect, .rbh circle, .rbh ellipse {
                  cursor: pointer;
                  transition: fill 0.15s ease, opacity 0.15s ease;
                }
                .rbh polygon:hover, .rbh path:hover {
                  opacity: 0.85 !important;
                }
              `}</style>
            </div>
          )}

          {/* ── РЕЖИМ ПОИСК ── */}
          {mode === 'search' && (
            <div>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по названию..."
                  className="input-field w-full pl-9 pr-8"
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Чипсы мышечных групп */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { slug: null,            label: 'Все' },
                  { slug: 'chest',         label: 'Грудь' },
                  { slug: 'upper-back',    label: 'Спина' },
                  { slug: 'front-deltoids',label: 'Плечи' },
                  { slug: 'biceps',        label: 'Бицепс' },
                  { slug: 'triceps',       label: 'Трицепс' },
                  { slug: 'quadriceps',    label: 'Квадрицепс' },
                  { slug: 'hamstring',     label: 'Бицепс бедра' },
                  { slug: 'gluteal',       label: 'Ягодицы' },
                  { slug: 'abs',           label: 'Пресс' },
                  { slug: 'calves',        label: 'Икры' },
                ].map(({ slug, label }) => (
                  <button
                    key={slug ?? 'all'}
                    onClick={() => setActiveMuscle(slug)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                      ${activeMuscle === slug
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-dark-elevated text-dark-muted border-dark-border hover:text-dark-text'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(search || activeMuscle) && (
                <p className="text-xs text-dark-muted mt-1.5">
                  {filtered.length === 0
                    ? 'Ничего не найдено'
                    : `${filtered.length} упражн${filtered.length === 1 ? 'ение' : filtered.length < 5 ? 'ения' : 'ений'}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Разделитель */}
        <div className="border-t border-dark-border/50 flex-shrink-0" />

        {/* ── Список упражнений ── */}
        <div className="overflow-y-auto flex-1 px-3 py-2">
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-dark-muted text-sm">Ничего не найдено</p>
              <button
                onClick={() => { setActiveMuscle(null); setSearch(''); }}
                className="text-primary-400 text-xs mt-2 hover:text-primary-300 transition-colors"
              >
                Сбросить фильтры
              </button>
            </div>
          )}

          <div className="space-y-0.5">
            {filtered.map(exercise => {
              const inWorkout = selectedIds.has(exercise.id);
              const inMulti   = multiPicked.has(exercise.id);
              // Цвет маркера мышцы
              const libSlugs = exercise.muscle_detail
                ? (MUSCLE_DETAIL_TO_LIB[exercise.muscle_detail] || [])
                : [];
              const markerColor = activeMuscle && libSlugs.includes(activeMuscle)
                ? '#f59e0b'   // amber — эта мышца активна
                : '#0d9488';  // teal  — обычный

              return (
                <button
                  key={exercise.id}
                  onClick={() => handleSelect(exercise)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                    ${inWorkout && !multiSelect
                      ? 'bg-primary-600/10 border border-primary-600/20'
                      : inMulti
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'hover:bg-dark-elevated border border-transparent'
                    }`}
                >
                  {/* Цветной маркер мышцы */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      backgroundColor: `${markerColor}20`,
                      border: `1px solid ${markerColor}40`,
                      color: markerColor,
                    }}
                  >
                    {inMulti || (inWorkout && !multiSelect)
                      ? <Check className="w-3.5 h-3.5" />
                      : (exercise.name_ru?.[0] ?? '?')
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">
                      {exercise.name_ru}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs" style={{ color: `${markerColor}cc` }}>
                        {LIB_MUSCLE_RU[libSlugs[0]] ?? exercise.primary_muscle}
                      </span>
                      {exercise.equipment && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-md border
                          ${EQUIPMENT_COLORS[exercise.equipment] || 'bg-dark-elevated text-dark-muted border-dark-border'}`}>
                          {EQUIPMENT_LABELS[exercise.equipment] || exercise.equipment}
                        </span>
                      )}
                      {exercise.is_compound && (
                        <span className="text-xs text-dark-muted">· база</span>
                      )}
                    </div>
                  </div>

                  {inWorkout && !multiSelect ? (
                    <span className="text-xs text-primary-400 font-medium flex-shrink-0">в тренировке</span>
                  ) : !multiSelect ? (
                    <ChevronRight className="w-4 h-4 text-dark-muted flex-shrink-0 opacity-40" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Кнопка мультиселекта ── */}
        {multiSelect && multiPicked.size > 0 && (
          <div className="px-4 pb-5 pt-2 border-t border-dark-border flex-shrink-0">
            <button
              onClick={() => onConfirmMulti?.(exercises.filter(e => multiPicked.has(e.id)))}
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

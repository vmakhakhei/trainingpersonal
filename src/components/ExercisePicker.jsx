// src/components/ExercisePicker.jsx
// Зависимость: npm install react-body-highlighter
// Документация: https://github.com/giavinh79/react-body-highlighter
import { useState, useMemo, useRef, useEffect } from 'react';
import Model from 'react-body-highlighter';
import { Search, X, ChevronRight, Check, RotateCcw } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Слаги react-body-highlighter → наши данные
// ─────────────────────────────────────────────────────────────────────────────
const SLUG_META = {
  'chest':          { ru: 'Грудь',           color: '#ef4444', primary: ['chest'] },
  'biceps':         { ru: 'Бицепс',          color: '#8b5cf6', primary: ['arms'] },
  'triceps':        { ru: 'Трицепс',         color: '#7c3aed', primary: ['arms'] },
  'forearm':        { ru: 'Предплечье',      color: '#6d28d9', primary: ['arms'] },
  'front-deltoids': { ru: 'Передняя дельта', color: '#f59e0b', primary: ['shoulders'] },
  'back-deltoids':  { ru: 'Задняя дельта',   color: '#d97706', primary: ['shoulders'] },
  'abs':            { ru: 'Пресс',           color: '#06b6d4', primary: ['core'] },
  'obliques':       { ru: 'Косые',           color: '#0891b2', primary: ['core'] },
  'trapezius':      { ru: 'Трапеция',        color: '#3b82f6', primary: ['back'] },
  'upper-back':     { ru: 'Верхняя спина',   color: '#2563eb', primary: ['back'] },
  'lower-back':     { ru: 'Поясница',        color: '#1d4ed8', primary: ['back', 'core'] },
  'quadriceps':     { ru: 'Квадрицепс',      color: '#10b981', primary: ['legs'] },
  'hamstring':      { ru: 'Бицепс бедра',    color: '#059669', primary: ['legs'] },
  'gluteal':        { ru: 'Ягодицы',         color: '#ec4899', primary: ['legs', 'glutes'] },
  'calves':         { ru: 'Икры',            color: '#047857', primary: ['legs'] },
  'adductors':      { ru: 'Приводящие',      color: '#065f46', primary: ['legs'] },
};

// Маппинг muscle_detail из БД → слаги библиотеки
const DETAIL_TO_SLUGS = {
  chest_upper:       ['chest'],
  chest_mid:         ['chest'],
  chest_lower:       ['chest'],
  back_lats:         ['upper-back'],
  back_traps:        ['trapezius'],
  back_rhomb:        ['upper-back'],
  back_lower:        ['lower-back'],
  shoulders_front:   ['front-deltoids'],
  shoulders_mid:     ['front-deltoids', 'back-deltoids'],
  shoulders_rear:    ['back-deltoids'],
  arms_bicep:        ['biceps'],
  arms_tricep:       ['triceps'],
  arms_forearm:      ['forearm'],
  legs_quad:         ['quadriceps'],
  legs_hamstr:       ['hamstring'],
  legs_glutes:       ['gluteal'],
  legs_calves:       ['calves'],
  core_abs:          ['abs'],
  core_obliq:        ['obliques'],
  core_lower:        ['lower-back'],
  glutes_max:        ['gluteal'],
  glutes_med:        ['gluteal', 'adductors'],
};

// primary_muscle → слаги (fallback если нет muscle_detail)
const PRIMARY_TO_SLUGS = {
  chest:     ['chest'],
  back:      ['upper-back', 'trapezius', 'lower-back'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  arms:      ['biceps', 'triceps', 'forearm'],
  legs:      ['quadriceps', 'hamstring', 'gluteal', 'calves'],
  core:      ['abs', 'obliques', 'lower-back'],
  glutes:    ['gluteal'],
};

// Подгруппы для панели детализации
const SUBGROUPS = {
  chest: [
    { detail: 'chest_upper', label: 'Верхняя',  slugs: ['chest'] },
    { detail: 'chest_mid',   label: 'Средняя',  slugs: ['chest'] },
    { detail: 'chest_lower', label: 'Нижняя',   slugs: ['chest'] },
  ],
  back: [
    { detail: 'back_lats',  label: 'Широчайшие',   slugs: ['upper-back'] },
    { detail: 'back_traps', label: 'Трапеция',      slugs: ['trapezius'] },
    { detail: 'back_rhomb', label: 'Ромбовидные',   slugs: ['upper-back'] },
    { detail: 'back_lower', label: 'Поясница',      slugs: ['lower-back'] },
  ],
  shoulders: [
    { detail: 'shoulders_front', label: 'Передняя дельта', slugs: ['front-deltoids'] },
    { detail: 'shoulders_mid',   label: 'Средняя дельта',  slugs: ['front-deltoids', 'back-deltoids'] },
    { detail: 'shoulders_rear',  label: 'Задняя дельта',   slugs: ['back-deltoids'] },
  ],
  arms: [
    { detail: 'arms_bicep',   label: 'Бицепс',      slugs: ['biceps'] },
    { detail: 'arms_tricep',  label: 'Трицепс',     slugs: ['triceps'] },
    { detail: 'arms_forearm', label: 'Предплечье',  slugs: ['forearm'] },
  ],
  legs: [
    { detail: 'legs_quad',   label: 'Квадрицепс',    slugs: ['quadriceps'] },
    { detail: 'legs_hamstr', label: 'Бицепс бедра',  slugs: ['hamstring'] },
    { detail: 'legs_glutes', label: 'Ягодицы',       slugs: ['gluteal'] },
    { detail: 'legs_calves', label: 'Икры',          slugs: ['calves'] },
  ],
  core: [
    { detail: 'core_abs',   label: 'Пресс',     slugs: ['abs'] },
    { detail: 'core_obliq', label: 'Косые',     slugs: ['obliques'] },
    { detail: 'core_lower', label: 'Поясница',  slugs: ['lower-back'] },
  ],
  glutes: [
    { detail: 'glutes_max', label: 'Большая ягодичная',  slugs: ['gluteal'] },
    { detail: 'glutes_med', label: 'Средняя ягодичная',  slugs: ['gluteal', 'adductors'] },
  ],
};

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
// Преобразуем упражнения в формат react-body-highlighter
// { name, muscles: ['chest', 'triceps', ...] }
// ─────────────────────────────────────────────────────────────────────────────
function buildModelData(exercises, activeSlug, activeDetail) {
  // Все мышцы которые встречаются в упражнениях
  const slugCounts = {};
  exercises.forEach(ex => {
    const slugs = ex.muscle_detail
      ? (DETAIL_TO_SLUGS[ex.muscle_detail] || PRIMARY_TO_SLUGS[ex.primary_muscle] || [])
      : (PRIMARY_TO_SLUGS[ex.primary_muscle] || []);
    slugs.forEach(s => { slugCounts[s] = (slugCounts[s] || 0) + 1; });
  });

  // Строим data для Model
  return Object.entries(slugCounts).map(([slug]) => ({
    name:    slug,
    muscles: [slug],
    // intensity 2 = активная мышца (ярко), 1 = есть упражнения (тускло)
    _active: slug === activeSlug,
  }));
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
  const [activeSlug, setActiveSlug] = useState(null);   // slug из библиотеки
  const [activeDetail, setActiveDetail] = useState(null); // muscle_detail подгруппа
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('body');              // 'body' | 'search'
  const [multiPicked, setMultiPicked] = useState(new Set());
  const searchRef = useRef(null);

  useEffect(() => {
    if (mode === 'search') setTimeout(() => searchRef.current?.focus(), 100);
  }, [mode]);

  // ── Активная группа мышц (primary) из слага ──────────────────────────────
  const activePrimaryGroup = useMemo(() => {
    if (!activeSlug) return null;
    const meta = SLUG_META[activeSlug];
    return meta?.primary?.[0] || null;
  }, [activeSlug]);

  // ── Подгруппы для активной мышцы ─────────────────────────────────────────
  const currentSubgroups = useMemo(() => {
    return activePrimaryGroup ? (SUBGROUPS[activePrimaryGroup] || []) : [];
  }, [activePrimaryGroup]);

  // ── Data для переднего вида ───────────────────────────────────────────────
  const frontData = useMemo(() => {
    const active = activeSlug ? [{ name: activeSlug, muscles: [activeSlug] }] : [];
    // Все мышцы с упражнениями — одна запись на слаг, intensity 1
    const allSlugs = new Set();
    exercises.forEach(ex => {
      const slugs = ex.muscle_detail
        ? (DETAIL_TO_SLUGS[ex.muscle_detail] || PRIMARY_TO_SLUGS[ex.primary_muscle] || [])
        : (PRIMARY_TO_SLUGS[ex.primary_muscle] || []);
      slugs.forEach(s => allSlugs.add(s));
    });
    const base = [...allSlugs].map(s => ({ name: s, muscles: [s] }));

    if (!activeSlug) return base;
    // Если есть активная — дублируем её запись с intensity 2 (второй цвет)
    // react-body-highlighter считает frequency по count записей
    return [...base, ...active];
  }, [exercises, activeSlug]);

  // ── Обработчик клика по телу ──────────────────────────────────────────────
  function handleBodyClick({ muscle }) {
    if (!SLUG_META[muscle]) return; // голова/шея/etc
    if (activeSlug === muscle) {
      setActiveSlug(null);
      setActiveDetail(null);
    } else {
      setActiveSlug(muscle);
      setActiveDetail(null);
    }
    setSearch('');
  }

  // ── Фильтрация списка ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = exercises;

    if (activeDetail) {
      list = list.filter(ex => ex.muscle_detail === activeDetail);
    } else if (activeSlug) {
      const meta = SLUG_META[activeSlug];
      const allowedPrimary = meta?.primary || [];
      list = list.filter(ex => {
        const exSlugs = ex.muscle_detail
          ? (DETAIL_TO_SLUGS[ex.muscle_detail] || [])
          : (PRIMARY_TO_SLUGS[ex.primary_muscle] || []);
        return exSlugs.includes(activeSlug) || allowedPrimary.includes(ex.primary_muscle);
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(ex =>
        ex.name_ru?.toLowerCase().includes(q) ||
        (EQUIPMENT_LABELS[ex.equipment] || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [exercises, activeSlug, activeDetail, search]);

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

  function reset() {
    setActiveSlug(null);
    setActiveDetail(null);
    setSearch('');
  }

  const activeColor = activeSlug ? SLUG_META[activeSlug]?.color : null;
  const activeLabelRu = activeSlug ? SLUG_META[activeSlug]?.ru : null;

  // Цвета для библиотеки:
  // [тусклый teal = есть упражнения, яркий amber = активная мышца]
  const modelColors = ['#0d948866', activeColor || '#f59e0b'];

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center">
      <div
        className="bg-dark-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(94vh, 740px)' }}
      >
        {/* ── Шапка ── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-0">
          <div className="w-10 h-1 bg-dark-border rounded-full mx-auto mb-3 sm:hidden" />

          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-semibold flex-1 text-base">{title}</h2>
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
            <button onClick={onClose}
              className="p-1.5 text-dark-muted hover:text-dark-text rounded-lg hover:bg-dark-elevated transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ════════════════════════
              РЕЖИМ: ТЕЛО
          ════════════════════════ */}
          {mode === 'body' && (
            <div className="pb-2">
              {/* Статусная строка */}
              <div className="flex items-center gap-2 h-7 mb-1">
                {activeSlug ? (
                  <>
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: activeColor }} />
                    <span className="text-sm font-semibold" style={{ color: activeColor }}>
                      {activeLabelRu}
                    </span>
                    <span className="text-xs text-dark-muted">· {filtered.length} упр.</span>
                    <button onClick={reset}
                      className="ml-auto flex items-center gap-1 text-xs text-dark-muted
                                 hover:text-primary-400 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Сбросить
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-dark-muted">
                    Нажми на мышцу — увидишь упражнения на неё
                  </p>
                )}
              </div>

              {/* Два вида тела + панель подгрупп */}
              <div className="flex gap-2 items-start">

                {/* Передний вид */}
                <div className="flex flex-col items-center" style={{ width: 110 }}>
                  <p className="text-[9px] text-dark-muted uppercase tracking-widest mb-0.5">Перёд</p>
                  <div
                    className="cursor-pointer select-none"
                    style={{ width: 110 }}
                  >
                    <Model
                      data={frontData}
                      style={{ width: '100%' }}
                      type="anterior"
                      bodyColor="#1a1a2e"
                      highlightedColors={modelColors}
                      onClick={handleBodyClick}
                    />
                  </div>
                </div>

                {/* Задний вид */}
                <div className="flex flex-col items-center" style={{ width: 110 }}>
                  <p className="text-[9px] text-dark-muted uppercase tracking-widest mb-0.5">Зад</p>
                  <div
                    className="cursor-pointer select-none"
                    style={{ width: 110 }}
                  >
                    <Model
                      data={frontData}
                      style={{ width: '100%' }}
                      type="posterior"
                      bodyColor="#1a1a2e"
                      highlightedColors={modelColors}
                      onClick={handleBodyClick}
                    />
                  </div>
                </div>

                {/* Панель справа: подгруппы или подсказка */}
                <div className="flex-1 flex flex-col justify-start pt-4 gap-1 min-w-0">
                  {!activeSlug ? (
                    // Список всех групп мышц
                    <div className="space-y-1">
                      {Object.entries(SLUG_META)
                        .filter(([, m]) => m.primary?.length)
                        .filter(([slug]) => !['adductors'].includes(slug)) // убираем дубли
                        .map(([slug, meta]) => (
                          <button
                            key={slug}
                            onClick={() => setActiveSlug(slug)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                                       bg-dark-elevated border border-dark-border
                                       hover:border-opacity-60 transition-all text-left text-xs"
                          >
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: meta.color }} />
                            <span className="truncate">{meta.ru}</span>
                          </button>
                        ))
                      }
                    </div>
                  ) : (
                    // Подгруппы активной мышцы
                    <div className="space-y-1">
                      <p className="text-[10px] text-dark-muted uppercase tracking-wide px-1 mb-1">
                        Детализация
                      </p>
                      {/* Кнопка "Все" = вся группа */}
                      <button
                        onClick={() => setActiveDetail(null)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                                    border transition-all text-left text-xs
                                    ${!activeDetail
                                      ? 'text-white border-opacity-60'
                                      : 'bg-dark-elevated border-dark-border text-dark-muted hover:text-dark-text'}`}
                        style={!activeDetail ? {
                          backgroundColor: `${activeColor}25`,
                          borderColor: `${activeColor}70`,
                          color: activeColor,
                        } : {}}
                      >
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: !activeDetail ? activeColor : '#4a4a6a' }} />
                        <span>Все</span>
                        {!activeDetail && <Check className="w-3 h-3 ml-auto" style={{ color: activeColor }} />}
                      </button>

                      {currentSubgroups.map(sub => (
                        <button
                          key={sub.detail}
                          onClick={() => setActiveDetail(
                            activeDetail === sub.detail ? null : sub.detail
                          )}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                                      border transition-all text-left text-xs
                                      ${activeDetail === sub.detail
                                        ? 'text-white'
                                        : 'bg-dark-elevated border-dark-border text-dark-muted hover:text-dark-text'}`}
                          style={activeDetail === sub.detail ? {
                            backgroundColor: `${activeColor}25`,
                            borderColor: `${activeColor}70`,
                            color: activeColor,
                          } : {}}
                        >
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: activeDetail === sub.detail
                                ? activeColor : '#3a3a5a',
                            }} />
                          <span className="leading-tight">{sub.label}</span>
                          {activeDetail === sub.detail && (
                            <Check className="w-3 h-3 ml-auto" style={{ color: activeColor }} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════
              РЕЖИМ: ПОИСК
          ════════════════════════ */}
          {mode === 'search' && (
            <div className="pb-2">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Жим, тяга, приседания..."
                  className="input-field w-full pl-9 pr-8"
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Горизонтальные чипсы */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { slug: null, label: 'Все', color: '#0d9488' },
                  ...Object.entries(SLUG_META)
                    .filter(([s]) => !['adductors'].includes(s))
                    .map(([slug, m]) => ({ slug, label: m.ru, color: m.color })),
                ].map(({ slug, label, color }) => (
                  <button
                    key={slug ?? 'all'}
                    onClick={() => { setActiveSlug(slug); setActiveDetail(null); }}
                    className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium
                               border transition-all"
                    style={activeSlug === slug
                      ? { backgroundColor: color, borderColor: color, color: '#fff' }
                      : { backgroundColor: 'transparent', borderColor: '#2a2a4a', color: '#7a7a9a' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(search || activeSlug) && (
                <p className="text-xs text-dark-muted mt-1.5">
                  {filtered.length === 0 ? 'Ничего не найдено' :
                    `${filtered.length} упражн${filtered.length === 1 ? 'ение' : filtered.length < 5 ? 'ения' : 'ений'}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Разделитель */}
        <div className="h-px bg-dark-border/50 flex-shrink-0" />

        {/* ── Список упражнений ── */}
        <div className="overflow-y-auto flex-1 px-3 py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-dark-muted text-sm">Ничего не найдено</p>
              <button onClick={reset}
                className="text-primary-400 text-xs mt-2 hover:text-primary-300 transition-colors">
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map(exercise => {
                const inWorkout = selectedIds.has(exercise.id);
                const inMulti   = multiPicked.has(exercise.id);
                const exSlugs   = exercise.muscle_detail
                  ? (DETAIL_TO_SLUGS[exercise.muscle_detail] || [])
                  : [];
                const dotColor = exSlugs[0] && SLUG_META[exSlugs[0]]
                  ? SLUG_META[exSlugs[0]].color
                  : '#0d9488';

                return (
                  <button
                    key={exercise.id}
                    onClick={() => handleSelect(exercise)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                      ${inWorkout && !multiSelect
                        ? 'bg-primary-600/10 border border-primary-600/20'
                        : inMulti
                          ? 'border border-amber-500/30 bg-amber-500/8'
                          : 'hover:bg-dark-elevated border border-transparent'
                      }`}
                  >
                    {/* Цветной маркер */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{
                        backgroundColor: `${dotColor}18`,
                        border: `1px solid ${dotColor}35`,
                        color: dotColor,
                      }}
                    >
                      {inMulti || (inWorkout && !multiSelect)
                        ? <Check className="w-3.5 h-3.5" />
                        : (exercise.name_ru?.[0] ?? '?')
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">{exercise.name_ru}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: `${dotColor}bb` }}>
                          {SLUG_META[exSlugs[0]]?.ru ?? exercise.primary_muscle}
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
          )}
        </div>

        {/* ── Мультиселект ── */}
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

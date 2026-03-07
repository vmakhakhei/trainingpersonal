// src/components/ExercisePicker.jsx
// Своя SVG-карта тела — никаких внешних зависимостей
import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronRight, Check, RotateCcw } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Конфиг мышечных групп
// ─────────────────────────────────────────────────────────────────────────────
const MUSCLES = {
  chest:     { ru: 'Грудь',          color: '#ef4444', primary: 'chest' },
  front_delt:{ ru: 'Передняя дельта',color: '#f59e0b', primary: 'shoulders' },
  mid_delt:  { ru: 'Средняя дельта', color: '#f59e0b', primary: 'shoulders' },
  rear_delt: { ru: 'Задняя дельта',  color: '#d97706', primary: 'shoulders' },
  biceps:    { ru: 'Бицепс',         color: '#8b5cf6', primary: 'arms' },
  triceps:   { ru: 'Трицепс',        color: '#7c3aed', primary: 'arms' },
  forearm:   { ru: 'Предплечье',     color: '#6d28d9', primary: 'arms' },
  abs:       { ru: 'Пресс',          color: '#06b6d4', primary: 'core' },
  obliques:  { ru: 'Косые',          color: '#0891b2', primary: 'core' },
  upper_back:{ ru: 'Верхняя спина',  color: '#3b82f6', primary: 'back' },
  lats:      { ru: 'Широчайшие',     color: '#2563eb', primary: 'back' },
  traps:     { ru: 'Трапеция',       color: '#60a5fa', primary: 'back' },
  lower_back:{ ru: 'Поясница',       color: '#1d4ed8', primary: 'back' },
  glutes:    { ru: 'Ягодицы',        color: '#ec4899', primary: 'glutes' },
  quads:     { ru: 'Квадрицепс',     color: '#10b981', primary: 'legs' },
  hamstrings:{ ru: 'Бицепс бедра',   color: '#059669', primary: 'legs' },
  calves:    { ru: 'Икры',           color: '#047857', primary: 'legs' },
};

// muscle_detail из БД → ключи в MUSCLES
const DETAIL_TO_MUSCLE = {
  chest_upper: 'chest', chest_mid: 'chest', chest_lower: 'chest',
  shoulders_front: 'front_delt', shoulders_mid: 'mid_delt', shoulders_rear: 'rear_delt',
  arms_bicep: 'biceps', arms_tricep: 'triceps', arms_forearm: 'forearm',
  back_lats: 'lats', back_traps: 'traps', back_rhomb: 'upper_back', back_lower: 'lower_back',
  core_abs: 'abs', core_obliq: 'obliques', core_lower: 'lower_back',
  legs_quad: 'quads', legs_hamstr: 'hamstrings', legs_glutes: 'glutes', legs_calves: 'calves',
  glutes_max: 'glutes', glutes_med: 'glutes',
};

// primary_muscle → ключи (фоллбек)
const PRIMARY_TO_MUSCLES = {
  chest: ['chest'],
  shoulders: ['front_delt', 'mid_delt'],
  arms: ['biceps', 'triceps'],
  back: ['lats', 'upper_back', 'traps', 'lower_back'],
  core: ['abs', 'obliques'],
  legs: ['quads', 'hamstrings', 'calves'],
  glutes: ['glutes'],
};

const EQUIPMENT_LABELS = {
  barbell:'Штанга', dumbbell:'Гантели', cable:'Блок',
  machine:'Тренажёр', bodyweight:'Тело', kettlebell:'Гиря', band:'Резина',
};
const EQUIPMENT_COLORS = {
  barbell:   'bg-orange-500/15 text-orange-300 border-orange-500/20',
  dumbbell:  'bg-blue-500/15 text-blue-300 border-blue-500/20',
  cable:     'bg-purple-500/15 text-purple-300 border-purple-500/20',
  machine:   'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  bodyweight:'bg-green-500/15 text-green-300 border-green-500/20',
  kettlebell:'bg-red-500/15 text-red-300 border-red-500/20',
  band:      'bg-pink-500/15 text-pink-300 border-pink-500/20',
};

function getMuscleKeys(ex) {
  if (ex.muscle_detail && DETAIL_TO_MUSCLE[ex.muscle_detail]) {
    return [DETAIL_TO_MUSCLE[ex.muscle_detail]];
  }
  return PRIMARY_TO_MUSCLES[ex.primary_muscle] || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Три чётких состояния каждой мышцы:
//   INACTIVE  — нет упражнений: тёмный фон, почти невидимый
//   AVAILABLE — есть упражнения, не выбрана: цветная подсветка, пунктирная обводка
//   ACTIVE    — выбрана: полный цвет, яркое свечение (glow-filter) + анимация
// ─────────────────────────────────────────────────────────────────────────────

function muscleState(key, activeMuscles, hasExercises) {
  if (activeMuscles.has(key)) return 'active';
  if (hasExercises.has(key)) return 'available';
  return 'inactive';
}

function muscleFill(key, state) {
  const c = MUSCLES[key].color;
  if (state === 'active')    return c;
  if (state === 'available') return `${c}30`;
  return '#111128';
}

function muscleStroke(key, state) {
  const c = MUSCLES[key].color;
  if (state === 'active')    return c;
  if (state === 'available') return `${c}aa`;
  return '#1e1e38';
}

function muscleStrokeW(state) {
  if (state === 'active')    return '1.5';
  if (state === 'available') return '1';
  return '0.5';
}

function muscleFilter(state) {
  return state === 'active' ? 'url(#glow)' : 'none';
}

function muscleStrokeDash(state) {
  return state === 'available' ? '2 1.5' : 'none';
}

function muscleCls(state) {
  if (state === 'inactive') return 'cursor-default opacity-40';
  return 'cursor-pointer transition-all duration-200 hover:brightness-125 hover:saturate-150';
}

// Shared SVG defs (glow filter + pulse animation)
function SvgDefs() {
  return (
    <defs>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <style>{`
        @keyframes muscle-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.7; }
        }
        .m-active {
          animation: muscle-pulse 1.8s ease-in-out infinite;
        }
      `}</style>
    </defs>
  );
}

// Хелпер: пропсы пути по состоянию
function mp(key, activeMuscles, hasExercises, onClick) {
  const state = muscleState(key, activeMuscles, hasExercises);
  return {
    fill:            muscleFill(key, state),
    stroke:          muscleStroke(key, state),
    strokeWidth:     muscleStrokeW(state),
    strokeDasharray: muscleStrokeDash(state),
    filter:          muscleFilter(state),
    className:       muscleCls(state) + (state === 'active' ? ' m-active' : ''),
    onClick:         state !== 'inactive' ? () => onClick(key) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG ТЕЛО — ПЕРЕДНИЙ ВИД  viewBox="0 0 120 280"
// ─────────────────────────────────────────────────────────────────────────────
function BodyFront({ activeMuscles, hasExercises, onMuscleClick }) {
  const p = (key) => mp(key, activeMuscles, hasExercises, onMuscleClick);

  return (
    <svg viewBox="0 0 120 280" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
      <SvgDefs/>
      {/* Голова */}
      <ellipse cx="60" cy="18" rx="13" ry="16" fill="#1a1a32" stroke="#252540" strokeWidth="0.8"/>
      {/* Шея */}
      <rect x="54" y="32" width="12" height="10" rx="3" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>

      {/* Трапеция */}
      <path d="M44 42 L60 38 L76 42 L72 52 L60 50 L48 52 Z" {...p('traps')}/>

      {/* Передняя дельта Л/П */}
      <path d="M36 44 L44 42 L48 52 L42 62 L34 56 Z" {...p('front_delt')}/>
      <path d="M84 44 L76 42 L72 52 L78 62 L86 56 Z" {...p('front_delt')}/>

      {/* Грудь */}
      <path d="M48 52 L60 50 L72 52 L70 72 L60 74 L50 72 Z" {...p('chest')}/>

      {/* Бицепс Л/П */}
      <path d="M34 56 L42 62 L40 80 L32 76 Z" {...p('biceps')}/>
      <path d="M86 56 L78 62 L80 80 L88 76 Z" {...p('biceps')}/>

      {/* Предплечье Л/П */}
      <path d="M32 76 L40 80 L38 98 L30 94 Z" {...p('forearm')}/>
      <path d="M88 76 L80 80 L82 98 L90 94 Z" {...p('forearm')}/>

      {/* Кисти */}
      <ellipse cx="31" cy="102" rx="6" ry="8" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>
      <ellipse cx="89" cy="102" rx="6" ry="8" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>

      {/* Пресс */}
      <path d="M50 72 L60 74 L70 72 L68 110 L60 112 L52 110 Z" {...p('abs')}/>
      {/* Сетка пресса поверх */}
      <line x1="60" y1="74" x2="60" y2="112" stroke="#ffffff08" strokeWidth="0.7"/>
      <line x1="51" y1="85" x2="69" y2="85" stroke="#ffffff08" strokeWidth="0.7"/>
      <line x1="51" y1="97" x2="69" y2="97" stroke="#ffffff08" strokeWidth="0.7"/>

      {/* Косые Л/П */}
      <path d="M42 68 L50 72 L52 110 L44 108 L38 80 Z" {...p('obliques')}/>
      <path d="M78 68 L70 72 L68 110 L76 108 L82 80 Z" {...p('obliques')}/>

      {/* Квадрицепс Л/П */}
      <path d="M44 112 L60 112 L58 162 L46 162 Z" {...p('quads')}/>
      <path d="M76 112 L60 112 L62 162 L74 162 Z" {...p('quads')}/>

      {/* Колени */}
      <ellipse cx="51" cy="166" rx="8" ry="5" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>
      <ellipse cx="69" cy="166" rx="8" ry="5" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>

      {/* Икры Л/П */}
      <path d="M46 172 L57 172 L56 210 L47 210 Z" {...p('calves')}/>
      <path d="M74 172 L63 172 L64 210 L73 210 Z" {...p('calves')}/>

      {/* Ступни */}
      <ellipse cx="51" cy="215" rx="7" ry="5" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>
      <ellipse cx="69" cy="215" rx="7" ry="5" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG ТЕЛО — ЗАДНИЙ ВИД
// ─────────────────────────────────────────────────────────────────────────────
function BodyBack({ activeMuscles, hasExercises, onMuscleClick }) {
  const p = (key) => mp(key, activeMuscles, hasExercises, onMuscleClick);

  return (
    <svg viewBox="0 0 120 280" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
      <SvgDefs/>
      {/* Голова */}
      <ellipse cx="60" cy="18" rx="13" ry="16" fill="#1a1a32" stroke="#252540" strokeWidth="0.8"/>
      {/* Шея */}
      <rect x="54" y="32" width="12" height="10" rx="3" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>

      {/* Трапеция */}
      <path d="M42 42 L60 36 L78 42 L74 58 L60 54 L46 58 Z" {...p('traps')}/>

      {/* Задняя дельта Л/П */}
      <path d="M34 46 L42 42 L46 58 L38 68 L30 58 Z" {...p('rear_delt')}/>
      <path d="M86 46 L78 42 L74 58 L82 68 L90 58 Z" {...p('rear_delt')}/>

      {/* Верхняя спина / ромбовидные */}
      <path d="M46 58 L60 54 L74 58 L72 76 L60 78 L48 76 Z" {...p('upper_back')}/>

      {/* Широчайшие Л/П */}
      <path d="M38 68 L46 58 L48 76 L46 106 L36 96 L32 76 Z" {...p('lats')}/>
      <path d="M82 68 L74 58 L72 76 L74 106 L84 96 L88 76 Z" {...p('lats')}/>

      {/* Трицепс Л/П */}
      <path d="M30 58 L38 68 L36 86 L28 80 Z" {...p('triceps')}/>
      <path d="M90 58 L82 68 L84 86 L92 80 Z" {...p('triceps')}/>

      {/* Предплечье Л/П */}
      <path d="M28 80 L36 86 L34 100 L26 96 Z" {...p('forearm')}/>
      <path d="M92 80 L84 86 L86 100 L94 96 Z" {...p('forearm')}/>

      {/* Кисти */}
      <ellipse cx="27" cy="104" rx="6" ry="8" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>
      <ellipse cx="93" cy="104" rx="6" ry="8" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>

      {/* Поясница */}
      <path d="M48 76 L60 78 L72 76 L72 110 L60 112 L48 110 Z" {...p('lower_back')}/>

      {/* Ягодицы */}
      <path d="M46 108 L60 112 L74 108 L74 138 L60 142 L46 138 Z" {...p('glutes')}/>

      {/* Бицепс бедра Л/П */}
      <path d="M46 138 L60 142 L58 172 L44 170 Z" {...p('hamstrings')}/>
      <path d="M74 138 L60 142 L62 172 L76 170 Z" {...p('hamstrings')}/>

      {/* Колени */}
      <ellipse cx="50" cy="175" rx="8" ry="5" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>
      <ellipse cx="70" cy="175" rx="8" ry="5" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>

      {/* Икры Л/П */}
      <path d="M44 180 L57 180 L55 216 L44 214 Z" {...p('calves')}/>
      <path d="M76 180 L63 180 L65 216 L76 214 Z" {...p('calves')}/>

      {/* Ступни */}
      <ellipse cx="50" cy="220" rx="7" ry="5" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>
      <ellipse cx="70" cy="220" rx="7" ry="5" fill="#1a1a32" stroke="#252540" strokeWidth="0.6"/>
    </svg>
  );
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
  const [activeMuscle, setActiveMuscle] = useState(null); // ключ из MUSCLES
  const [search, setSearch]             = useState('');
  const [mode, setMode]                 = useState('body');
  const [multiPicked, setMultiPicked]   = useState(new Set());
  const searchRef = useRef(null);

  useEffect(() => {
    if (mode === 'search') setTimeout(() => searchRef.current?.focus(), 100);
  }, [mode]);

  // Набор мышц у которых есть хоть одно упражнение
  const hasExercises = useMemo(() => {
    const set = new Set();
    exercises.forEach(ex => getMuscleKeys(ex).forEach(k => set.add(k)));
    return set;
  }, [exercises]);

  const activeMuscles = useMemo(() => {
    return activeMuscle ? new Set([activeMuscle]) : new Set();
  }, [activeMuscle]);

  function handleMuscleClick(key) {
    setActiveMuscle(prev => prev === key ? null : key);
    setSearch('');
    setMode('body');
  }

  // Фильтрация
  const filtered = useMemo(() => {
    let list = exercises;
    if (activeMuscle) {
      list = list.filter(ex => getMuscleKeys(ex).includes(activeMuscle));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(ex =>
        ex.name_ru?.toLowerCase().includes(q) ||
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

  function reset() { setActiveMuscle(null); setSearch(''); }

  const activeColor = activeMuscle ? MUSCLES[activeMuscle]?.color : null;
  const activeLabelRu = activeMuscle ? MUSCLES[activeMuscle]?.ru : null;

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center">
      <div
        className="bg-dark-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(94vh, 740px)' }}
      >
        {/* Шапка */}
        <div className="flex-shrink-0 px-4 pt-3 pb-0">
          <div className="w-10 h-1 bg-dark-border rounded-full mx-auto mb-3 sm:hidden"/>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-semibold flex-1 text-base">{title}</h2>
            <div className="flex bg-dark-elevated rounded-lg p-0.5 border border-dark-border">
              <button onClick={() => setMode('body')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${mode==='body' ? 'bg-primary-600 text-white' : 'text-dark-muted hover:text-dark-text'}`}>
                🫀 Тело
              </button>
              <button onClick={() => setMode('search')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${mode==='search' ? 'bg-primary-600 text-white' : 'text-dark-muted hover:text-dark-text'}`}>
                🔍 Поиск
              </button>
            </div>
            <button onClick={onClose}
              className="p-1.5 text-dark-muted hover:text-dark-text rounded-lg hover:bg-dark-elevated transition-colors">
              <X className="w-5 h-5"/>
            </button>
          </div>

          {/* ══ ТЕЛО ══ */}
          {mode === 'body' && (
            <div className="pb-2">
              {/* Статус */}
              <div className="flex items-center gap-2 h-7 mb-1">
                {activeMuscle ? (
                  <>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: activeColor }}/>
                    <span className="text-sm font-semibold" style={{ color: activeColor }}>{activeLabelRu}</span>
                    <span className="text-xs text-dark-muted">· {filtered.length} упр.</span>
                    <button onClick={reset}
                      className="ml-auto flex items-center gap-1 text-xs text-dark-muted hover:text-primary-400 transition-colors">
                      <RotateCcw className="w-3 h-3"/> Сбросить
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-dark-muted">Нажми на мышцу — увидишь упражнения</p>
                )}
              </div>

              {/* Два вида + список групп */}
              <div className="flex gap-2 items-start">
                <div className="flex flex-col items-center" style={{ width: 108 }}>
                  <p className="text-[9px] text-dark-muted uppercase tracking-widest mb-0.5">Перёд</p>
                  <BodyFront activeMuscles={activeMuscles} hasExercises={hasExercises} onMuscleClick={handleMuscleClick}/>
                </div>
                <div className="flex flex-col items-center" style={{ width: 108 }}>
                  <p className="text-[9px] text-dark-muted uppercase tracking-widest mb-0.5">Зад</p>
                  <BodyBack activeMuscles={activeMuscles} hasExercises={hasExercises} onMuscleClick={handleMuscleClick}/>
                </div>

                {/* Список мышечных групп справа */}
                <div className="flex-1 flex flex-col pt-4 gap-0.5 min-w-0 max-h-60 overflow-y-auto">
                  {Object.entries(MUSCLES).map(([key, meta]) => {
                    const count = exercises.filter(ex => getMuscleKeys(ex).includes(key)).length;
                    if (count === 0) return null;
                    const isActive = activeMuscle === key;
                    return (
                      <button key={key} onClick={() => handleMuscleClick(key)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all text-left"
                        style={isActive ? {
                          backgroundColor: `${meta.color}20`,
                          borderColor: `${meta.color}60`,
                        } : {
                          backgroundColor: 'transparent',
                          borderColor: '#2a2a4a',
                        }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }}/>
                        <span className="text-xs truncate" style={{ color: isActive ? meta.color : '#8a8aaa' }}>
                          {meta.ru}
                        </span>
                        <span className="text-[10px] text-dark-muted ml-auto flex-shrink-0">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══ ПОИСК ══ */}
          {mode === 'search' && (
            <div className="pb-2">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted"/>
                <input ref={searchRef} type="text" value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Жим, тяга, приседания..."
                  className="input-field w-full pl-9 pr-8"/>
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button onClick={reset}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                  style={!activeMuscle
                    ? { backgroundColor: '#0d9488', borderColor: '#0d9488', color: '#fff' }
                    : { backgroundColor: 'transparent', borderColor: '#2a2a4a', color: '#7a7a9a' }}>
                  Все
                </button>
                {Object.entries(MUSCLES).map(([key, meta]) => {
                  const count = exercises.filter(ex => getMuscleKeys(ex).includes(key)).length;
                  if (count === 0) return null;
                  const isActive = activeMuscle === key;
                  return (
                    <button key={key} onClick={() => setActiveMuscle(isActive ? null : key)}
                      className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                      style={isActive
                        ? { backgroundColor: meta.color, borderColor: meta.color, color: '#fff' }
                        : { backgroundColor: 'transparent', borderColor: '#2a2a4a', color: '#7a7a9a' }}>
                      {meta.ru}
                    </button>
                  );
                })}
              </div>
              {(search || activeMuscle) && (
                <p className="text-xs text-dark-muted mt-1.5">
                  {filtered.length === 0 ? 'Ничего не найдено' :
                    `${filtered.length} упражн${filtered.length===1?'ение':filtered.length<5?'ения':'ений'}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-dark-border/50 flex-shrink-0"/>

        {/* Список упражнений */}
        <div className="overflow-y-auto flex-1 px-3 py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-dark-muted text-sm">Ничего не найдено</p>
              <button onClick={reset} className="text-primary-400 text-xs mt-2 hover:text-primary-300 transition-colors">
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map(exercise => {
                const inWorkout = selectedIds.has(exercise.id);
                const inMulti   = multiPicked.has(exercise.id);
                const keys      = getMuscleKeys(exercise);
                const dotColor  = keys[0] && MUSCLES[keys[0]] ? MUSCLES[keys[0]].color : '#0d9488';
                const isHighlighted = activeMuscle && keys.includes(activeMuscle);

                return (
                  <button key={exercise.id} onClick={() => handleSelect(exercise)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                      ${inWorkout && !multiSelect
                        ? 'bg-primary-600/10 border border-primary-600/20'
                        : inMulti
                          ? 'border border-amber-500/30 bg-amber-500/8'
                          : isHighlighted
                            ? 'border bg-dark-elevated'
                            : 'hover:bg-dark-elevated border border-transparent'}`}
                    style={isHighlighted && !inWorkout && !inMulti
                      ? { borderColor: `${dotColor}40` }
                      : {}}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ backgroundColor: `${dotColor}18`, border: `1px solid ${dotColor}35`, color: dotColor }}>
                      {inMulti || (inWorkout && !multiSelect)
                        ? <Check className="w-3.5 h-3.5"/>
                        : (exercise.name_ru?.[0] ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">{exercise.name_ru}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: `${dotColor}bb` }}>
                          {MUSCLES[keys[0]]?.ru ?? exercise.primary_muscle}
                        </span>
                        {exercise.equipment && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-md border
                            ${EQUIPMENT_COLORS[exercise.equipment] || 'bg-dark-elevated text-dark-muted border-dark-border'}`}>
                            {EQUIPMENT_LABELS[exercise.equipment] || exercise.equipment}
                          </span>
                        )}
                        {exercise.is_compound && <span className="text-xs text-dark-muted">· база</span>}
                      </div>
                    </div>
                    {inWorkout && !multiSelect
                      ? <span className="text-xs text-primary-400 font-medium flex-shrink-0">в тренировке</span>
                      : !multiSelect
                        ? <ChevronRight className="w-4 h-4 text-dark-muted flex-shrink-0 opacity-40"/>
                        : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {multiSelect && multiPicked.size > 0 && (
          <div className="px-4 pb-5 pt-2 border-t border-dark-border flex-shrink-0">
            <button onClick={() => onConfirmMulti?.(exercises.filter(e => multiPicked.has(e.id)))}
              className="btn-primary w-full flex items-center justify-center gap-2">
              <Check className="w-4 h-4"/>
              Добавить {multiPicked.size} упражн{multiPicked.size===1?'ение':multiPicked.size<5?'ения':'ений'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

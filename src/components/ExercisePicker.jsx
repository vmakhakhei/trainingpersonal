// src/components/ExercisePicker.jsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronRight, Check, RotateCcw } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// МЫШЕЧНАЯ ИЕРАРХИЯ
// primary_muscle из БД → подгруппы с русскими названиями
// ─────────────────────────────────────────────────────────────────────────────
const MUSCLE_TREE = {
  chest: {
    label: 'Грудь',
    color: '#ef4444',
    subs: [
      { key: 'chest_upper', label: 'Верхняя' },
      { key: 'chest_mid',   label: 'Средняя' },
      { key: 'chest_lower', label: 'Нижняя' },
    ],
  },
  back: {
    label: 'Спина',
    color: '#3b82f6',
    subs: [
      { key: 'back_lats',  label: 'Широчайшие' },
      { key: 'back_traps', label: 'Трапеция' },
      { key: 'back_rhomb', label: 'Ромбовидные' },
      { key: 'back_lower', label: 'Поясница' },
    ],
  },
  shoulders: {
    label: 'Плечи',
    color: '#f59e0b',
    subs: [
      { key: 'shoulders_front', label: 'Передняя дельта' },
      { key: 'shoulders_mid',   label: 'Средняя дельта' },
      { key: 'shoulders_rear',  label: 'Задняя дельта' },
    ],
  },
  arms: {
    label: 'Руки',
    color: '#8b5cf6',
    subs: [
      { key: 'arms_bicep',    label: 'Бицепс' },
      { key: 'arms_tricep',   label: 'Трицепс' },
      { key: 'arms_forearm',  label: 'Предплечье' },
    ],
  },
  legs: {
    label: 'Ноги',
    color: '#10b981',
    subs: [
      { key: 'legs_quad',   label: 'Квадрицепс' },
      { key: 'legs_hamstr', label: 'Бицепс бедра' },
      { key: 'legs_glutes', label: 'Ягодицы' },
      { key: 'legs_calves', label: 'Икры' },
    ],
  },
  core: {
    label: 'Корпус',
    color: '#06b6d4',
    subs: [
      { key: 'core_abs',    label: 'Пресс' },
      { key: 'core_obliq',  label: 'Косые' },
      { key: 'core_lower',  label: 'Поясница' },
    ],
  },
  glutes: {
    label: 'Ягодицы',
    color: '#ec4899',
    subs: [
      { key: 'glutes_max', label: 'Большая' },
      { key: 'glutes_med', label: 'Средняя' },
    ],
  },
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
  barbell:    'bg-orange-500/15 text-orange-300 border-orange-500/20',
  dumbbell:   'bg-blue-500/15 text-blue-300 border-blue-500/20',
  cable:      'bg-purple-500/15 text-purple-300 border-purple-500/20',
  machine:    'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  bodyweight: 'bg-green-500/15 text-green-300 border-green-500/20',
  kettlebell: 'bg-red-500/15 text-red-300 border-red-500/20',
  band:       'bg-pink-500/15 text-pink-300 border-pink-500/20',
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG КАРТА ТЕЛА
// Передний и задний вид. Каждая зона — кликабельная область.
// ─────────────────────────────────────────────────────────────────────────────

// Зоны для ПЕРЕДНЕГО вида: { id: primary_muscle_key, d: SVG-path, cx, cy }
const FRONT_ZONES = [
  // Голова (не кликабельна, декоративная)
  { id: null,        shape: 'ellipse', cx: 80, cy: 22, rx: 16, ry: 19, decorative: true },
  // Шея
  { id: null,        shape: 'rect', x: 73, y: 40, w: 14, h: 10, decorative: true },
  // Трапеция (плечи сверху)
  { id: 'shoulders', shape: 'path', d: 'M60,48 Q80,42 100,48 L108,58 Q80,52 52,58 Z', label: 'Плечи' },
  // Грудь левая
  { id: 'chest',     shape: 'ellipse', cx: 68, cy: 68, rx: 13, ry: 14, label: 'Грудь' },
  // Грудь правая
  { id: 'chest',     shape: 'ellipse', cx: 92, cy: 68, rx: 13, ry: 14, label: 'Грудь' },
  // Плечи (дельты передние) — боковые круглые
  { id: 'shoulders', shape: 'ellipse', cx: 50, cy: 62, rx: 9, ry: 11, label: 'Плечи' },
  { id: 'shoulders', shape: 'ellipse', cx: 110, cy: 62, rx: 9, ry: 11, label: 'Плечи' },
  // Бицепс левый
  { id: 'arms',      shape: 'ellipse', cx: 43, cy: 82, rx: 7, ry: 14, label: 'Руки' },
  // Бицепс правый
  { id: 'arms',      shape: 'ellipse', cx: 117, cy: 82, rx: 7, ry: 14, label: 'Руки' },
  // Предплечье левое
  { id: 'arms',      shape: 'ellipse', cx: 40, cy: 105, rx: 6, ry: 12, label: 'Руки' },
  // Предплечье правое
  { id: 'arms',      shape: 'ellipse', cx: 120, cy: 105, rx: 6, ry: 12, label: 'Руки' },
  // Пресс
  { id: 'core',      shape: 'rect', x: 70, y: 84, w: 20, h: 26, rx: 4, label: 'Корпус' },
  // Косые левые
  { id: 'core',      shape: 'ellipse', cx: 63, cy: 95, rx: 7, ry: 14, label: 'Корпус' },
  // Косые правые
  { id: 'core',      shape: 'ellipse', cx: 97, cy: 95, rx: 7, ry: 14, label: 'Корпус' },
  // Квадрицепс левый
  { id: 'legs',      shape: 'ellipse', cx: 68, cy: 140, rx: 13, ry: 22, label: 'Ноги' },
  // Квадрицепс правый
  { id: 'legs',      shape: 'ellipse', cx: 92, cy: 140, rx: 13, ry: 22, label: 'Ноги' },
  // Колено левое
  { id: null,        shape: 'ellipse', cx: 68, cy: 164, rx: 9, ry: 7, decorative: true },
  { id: null,        shape: 'ellipse', cx: 92, cy: 164, rx: 9, ry: 7, decorative: true },
  // Икра левая
  { id: 'legs',      shape: 'ellipse', cx: 68, cy: 186, rx: 9, ry: 16, label: 'Ноги' },
  // Икра правая
  { id: 'legs',      shape: 'ellipse', cx: 92, cy: 186, rx: 9, ry: 16, label: 'Ноги' },
];

const BACK_ZONES = [
  // Голова
  { id: null,        shape: 'ellipse', cx: 80, cy: 22, rx: 16, ry: 19, decorative: true },
  { id: null,        shape: 'rect', x: 73, y: 40, w: 14, h: 10, decorative: true },
  // Трапеция верхняя
  { id: 'back',      shape: 'path', d: 'M60,46 Q80,38 100,46 L105,62 Q80,55 55,62 Z', label: 'Спина' },
  // Задняя дельта левая
  { id: 'shoulders', shape: 'ellipse', cx: 50, cy: 62, rx: 9, ry: 11, label: 'Плечи' },
  { id: 'shoulders', shape: 'ellipse', cx: 110, cy: 62, rx: 9, ry: 11, label: 'Плечи' },
  // Широчайшие левые
  { id: 'back',      shape: 'path', d: 'M56,60 Q48,80 54,105 Q62,110 70,100 L70,60 Z', label: 'Спина' },
  // Широчайшие правые
  { id: 'back',      shape: 'path', d: 'M104,60 Q112,80 106,105 Q98,110 90,100 L90,60 Z', label: 'Спина' },
  // Ромбовидные / средняя спина
  { id: 'back',      shape: 'rect', x: 70, y: 62, w: 20, h: 35, rx: 3, label: 'Спина' },
  // Трицепс левый
  { id: 'arms',      shape: 'ellipse', cx: 43, cy: 82, rx: 7, ry: 14, label: 'Руки' },
  { id: 'arms',      shape: 'ellipse', cx: 117, cy: 82, rx: 7, ry: 14, label: 'Руки' },
  // Предплечье
  { id: 'arms',      shape: 'ellipse', cx: 40, cy: 105, rx: 6, ry: 12, label: 'Руки' },
  { id: 'arms',      shape: 'ellipse', cx: 120, cy: 105, rx: 6, ry: 12, label: 'Руки' },
  // Поясница
  { id: 'back',      shape: 'rect', x: 68, y: 98, w: 24, h: 16, rx: 4, label: 'Спина' },
  // Ягодицы левые
  { id: 'legs',      shape: 'ellipse', cx: 68, cy: 128, rx: 14, ry: 14, label: 'Ноги' },
  { id: 'legs',      shape: 'ellipse', cx: 92, cy: 128, rx: 14, ry: 14, label: 'Ноги' },
  // Бицепс бедра левый
  { id: 'legs',      shape: 'ellipse', cx: 68, cy: 152, rx: 12, ry: 18, label: 'Ноги' },
  { id: 'legs',      shape: 'ellipse', cx: 92, cy: 152, rx: 12, ry: 18, label: 'Ноги' },
  // Колено
  { id: null,        shape: 'ellipse', cx: 68, cy: 172, rx: 9, ry: 7, decorative: true },
  { id: null,        shape: 'ellipse', cx: 92, cy: 172, rx: 9, ry: 7, decorative: true },
  // Икра
  { id: 'legs',      shape: 'ellipse', cx: 68, cy: 190, rx: 9, ry: 14, label: 'Ноги' },
  { id: 'legs',      shape: 'ellipse', cx: 92, cy: 190, rx: 9, ry: 14, label: 'Ноги' },
];

// Тело-силуэт (декоративный контур)
function BodyOutline({ side }) {
  // Общий контур тела — упрощённый
  const d = side === 'front'
    ? `M80,3 C68,3 64,8 64,20 C64,30 68,38 64,42
       C54,44 42,52 40,62 C38,70 38,76 36,80
       C34,90 34,100 36,112 C38,120 38,122 36,128
       C34,135 32,145 34,158 C36,168 36,170 34,175
       C32,183 32,188 34,200 L40,204
       C40,196 40,190 42,182 C44,175 44,172 44,168
       C46,160 48,150 48,142 C48,134 50,130 52,125
       C54,120 56,118 58,115 C60,112 62,112 64,112
       L64,115 C66,118 72,120 80,120
       C88,120 94,118 96,115 L96,112
       C98,112 100,112 102,115 C104,118 106,120 108,125
       C110,130 112,134 112,142 C112,150 114,160 116,168
       C116,172 116,175 118,182 C120,190 120,196 120,204
       L126,200 C128,188 128,183 126,175
       C124,170 124,168 126,158 C128,145 126,135 124,128
       C122,122 122,120 124,112 C126,100 126,90 124,80
       C122,76 122,70 120,62 C118,52 106,44 96,42
       C92,38 96,30 96,20 C96,8 92,3 80,3 Z`
    : `M80,3 C68,3 64,8 64,20 C64,30 68,38 64,42
       C54,44 42,52 40,62 C38,70 38,76 36,80
       C34,90 34,100 36,112 C38,120 38,122 36,128
       C34,135 32,148 36,162 C38,168 38,172 36,178
       C34,186 34,192 36,204 L42,206
       C42,196 42,190 44,182 C46,174 46,170 46,165
       C48,155 50,145 50,136 C50,128 52,124 56,120
       L64,115 C66,118 72,120 80,120
       C88,120 94,118 96,115 L104,120
       C108,124 110,128 110,136 C110,145 112,155 114,165
       C114,170 114,174 116,182 C118,190 118,196 118,206
       L124,204 C126,192 126,186 124,178
       C122,172 122,168 124,162 C128,148 126,135 124,128
       C122,122 122,120 124,112 C126,100 126,90 124,80
       C122,76 122,70 120,62 C118,52 106,44 96,42
       C92,38 96,30 96,20 C96,8 92,3 80,3 Z`;

  return <path d={d} fill="#1a1a2e" stroke="#2a2a4a" strokeWidth="1.5" />;
}

function renderShape(zone, isActive, colorHex, alpha) {
  const fill = isActive
    ? `${colorHex}cc`
    : zone.decorative
      ? '#252540'
      : `${colorHex}33`;

  const stroke = isActive ? colorHex : zone.decorative ? '#2a2a4a' : `${colorHex}66`;

  const commonProps = { fill, stroke, strokeWidth: isActive ? 1.5 : 1, style: { transition: 'all 0.2s' } };

  if (zone.shape === 'ellipse') {
    return <ellipse cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry} {...commonProps} />;
  }
  if (zone.shape === 'rect') {
    return <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={zone.rx || 0} {...commonProps} />;
  }
  if (zone.shape === 'path') {
    return <path d={zone.d} {...commonProps} />;
  }
  return null;
}

function BodyMap({ activeMuscle, onMuscleClick, side, exercisesPerMuscle }) {
  const zones = side === 'front' ? FRONT_ZONES : BACK_ZONES;

  return (
    <svg viewBox="0 0 160 215" className="w-full h-full" style={{ maxHeight: 260 }}>
      {/* Тело-контур */}
      <BodyOutline side={side} />

      {/* Зоны мышц */}
      {zones.map((zone, i) => {
        if (zone.decorative) {
          return (
            <g key={i}>
              {renderShape(zone, false, '#374151', 0.3)}
            </g>
          );
        }
        const muscleKey = zone.id;
        const info = MUSCLE_TREE[muscleKey];
        if (!info) return null;
        const isActive = activeMuscle === muscleKey;
        const hasExercises = (exercisesPerMuscle[muscleKey] || 0) > 0;

        return (
          <g
            key={i}
            onClick={() => onMuscleClick(muscleKey)}
            style={{ cursor: 'pointer' }}
          >
            {renderShape(zone, isActive, info.color, hasExercises ? 0.5 : 0.2)}
          </g>
        );
      })}

      {/* Подписи активных зон */}
      {activeMuscle && (() => {
        const info = MUSCLE_TREE[activeMuscle];
        // Находим центр первой зоны для подписи
        const z = zones.find(z => z.id === activeMuscle);
        if (!z || !info) return null;
        const cx = z.cx ?? (z.x + (z.w || 0) / 2) ?? 80;
        const cy = z.cy ?? (z.y + (z.h || 0) / 2) ?? 80;
        return (
          <text
            x={cx} y={cy + (z.ry || z.h / 2 || 10) + 8}
            textAnchor="middle" fontSize="7" fill={info.color}
            fontWeight="600"
          >
            {info.label}
          </text>
        );
      })()}
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
  const [search, setSearch]             = useState('');
  const [side, setSide]                 = useState('front');    // 'front' | 'back'
  const [activeMuscle, setActiveMuscle] = useState(null);       // primary_muscle key
  const [activeSub, setActiveSub]       = useState(null);       // sub-muscle key
  const [multiPicked, setMultiPicked]   = useState(new Set());
  const [mode, setMode]                 = useState('body');      // 'body' | 'search'
  const searchRef = useRef(null);

  useEffect(() => {
    if (mode === 'search') setTimeout(() => searchRef.current?.focus(), 120);
  }, [mode]);

  // Кол-во упражнений по мышцам для визуальной интенсивности зон
  const exercisesPerMuscle = useMemo(() => {
    const map = {};
    exercises.forEach(e => {
      if (e.primary_muscle) map[e.primary_muscle] = (map[e.primary_muscle] || 0) + 1;
    });
    return map;
  }, [exercises]);

  function handleMuscleClick(key) {
    if (activeMuscle === key) {
      setActiveMuscle(null);
      setActiveSub(null);
    } else {
      setActiveMuscle(key);
      setActiveSub(null);
    }
  }

  // Фильтрация итогового списка
  const filtered = useMemo(() => {
    let list = exercises;
    if (activeMuscle) list = list.filter(e => e.primary_muscle === activeMuscle);
    // При выборе подгруппы — пока фильтруем по primary_muscle (т.к. в БД нет sub-полей)
    // В будущем можно добавить secondary_muscles фильтрацию
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name_ru?.toLowerCase().includes(q) ||
        e.primary_muscle?.toLowerCase().includes(q) ||
        e.equipment?.toLowerCase().includes(q) ||
        (EQUIPMENT_LABELS[e.equipment] || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [exercises, activeMuscle, activeSub, search]);

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

  function clearFilters() {
    setActiveMuscle(null);
    setActiveSub(null);
    setSearch('');
  }

  const activeInfo = activeMuscle ? MUSCLE_TREE[activeMuscle] : null;
  const hasFilters = activeMuscle || search.trim();

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center">
      <div
        className="bg-dark-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(92vh, 700px)' }}
      >

        {/* ── Шапка ── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-0">
          <div className="w-10 h-1 bg-dark-border rounded-full mx-auto mb-3 sm:hidden" />

          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold flex-1">{title}</h2>

            {/* Переключатель режима */}
            <div className="flex bg-dark-elevated rounded-lg p-0.5 border border-dark-border">
              <button
                onClick={() => setMode('body')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${mode === 'body' ? 'bg-primary-600 text-white' : 'text-dark-muted'}`}
              >
                🫀 Тело
              </button>
              <button
                onClick={() => setMode('search')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${mode === 'search' ? 'bg-primary-600 text-white' : 'text-dark-muted'}`}
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

          {/* ── РЕЖИМ: ТЕЛО ── */}
          {mode === 'body' && (
            <div>
              {/* Переключатель перед/зад */}
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setSide('front')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${side === 'front'
                      ? 'border-primary-500/50 bg-primary-600/15 text-primary-300'
                      : 'border-dark-border text-dark-muted hover:text-dark-text'}`}
                >
                  Передний вид
                </button>
                <button
                  onClick={() => setSide('back')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${side === 'back'
                      ? 'border-primary-500/50 bg-primary-600/15 text-primary-300'
                      : 'border-dark-border text-dark-muted hover:text-dark-text'}`}
                >
                  Задний вид
                </button>
              </div>

              {/* SVG карта тела */}
              <div className="flex gap-3">
                <div
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{ width: 130, height: 220 }}
                >
                  <BodyMap
                    activeMuscle={activeMuscle}
                    onMuscleClick={handleMuscleClick}
                    side={side}
                    exercisesPerMuscle={exercisesPerMuscle}
                  />
                </div>

                {/* Правая панель: мышечные группы + подгруппы */}
                <div className="flex-1 flex flex-col justify-center gap-1.5 py-2">
                  {!activeMuscle ? (
                    <>
                      <p className="text-xs text-dark-muted mb-1">Нажми на мышцу на схеме или выбери:</p>
                      {Object.entries(MUSCLE_TREE).map(([key, info]) => {
                        const cnt = exercisesPerMuscle[key] || 0;
                        return (
                          <button
                            key={key}
                            onClick={() => handleMuscleClick(key)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                                       border border-dark-border hover:border-opacity-60
                                       bg-dark-elevated hover:bg-dark-border transition-all text-left"
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: info.color }}
                            />
                            <span className="text-sm flex-1">{info.label}</span>
                            {cnt > 0 && (
                              <span className="text-xs text-dark-muted">{cnt}</span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {/* Активная группа */}
                      <button
                        onClick={() => { setActiveMuscle(null); setActiveSub(null); }}
                        className="flex items-center gap-2 mb-1"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: activeInfo?.color }}
                        />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: activeInfo?.color }}
                        >
                          {activeInfo?.label}
                        </span>
                        <span className="text-xs text-dark-muted">
                          {exercisesPerMuscle[activeMuscle] || 0} упр.
                        </span>
                        <X className="w-3 h-3 text-dark-muted ml-auto" />
                      </button>

                      <p className="text-xs text-dark-muted mb-0.5">Детализация:</p>

                      {/* Подгруппы */}
                      {activeInfo?.subs.map(sub => (
                        <button
                          key={sub.key}
                          onClick={() => setActiveSub(activeSub === sub.key ? null : sub.key)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left text-sm
                            ${activeSub === sub.key
                              ? 'border-opacity-60 text-white'
                              : 'border-dark-border text-dark-muted hover:text-dark-text bg-dark-elevated hover:bg-dark-border'
                            }`}
                          style={activeSub === sub.key
                            ? { borderColor: activeInfo.color, backgroundColor: `${activeInfo.color}25`, color: activeInfo.color }
                            : {}
                          }
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: activeSub === sub.key ? activeInfo.color : '#4a4a6a' }}
                          />
                          {sub.label}
                          {activeSub === sub.key && (
                            <Check className="w-3 h-3 ml-auto" style={{ color: activeInfo.color }} />
                          )}
                        </button>
                      ))}

                      {/* Подсказка про подгруппы */}
                      {activeSub && (
                        <p className="text-xs text-dark-muted mt-1 leading-tight">
                          Показаны все упражнения на {activeInfo?.label.toLowerCase()} — детализация по подгруппам появится после расширения базы упражнений
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Активные фильтры-бейджи */}
              {hasFilters && (
                <div className="flex items-center gap-2 pt-2 pb-1 border-t border-dark-border/50">
                  {activeMuscle && (
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${activeInfo?.color}25`,
                        color: activeInfo?.color,
                        border: `1px solid ${activeInfo?.color}44`,
                      }}
                    >
                      {activeInfo?.label}
                      {activeSub && ` › ${activeInfo?.subs.find(s => s.key === activeSub)?.label}`}
                      <button onClick={() => { setActiveMuscle(null); setActiveSub(null); }}>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                  <span className="text-xs text-dark-muted ml-auto">
                    {filtered.length} упражн{filtered.length === 1 ? 'ение' : filtered.length < 5 ? 'ения' : 'ений'}
                  </span>
                  <button onClick={clearFilters} className="text-xs text-dark-muted hover:text-primary-400 transition-colors">
                    сбросить
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── РЕЖИМ: ПОИСК ── */}
          {mode === 'search' && (
            <div className="mb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Жим, Тяга, Приседания..."
                  className="input-field w-full pl-9 pr-8"
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Горизонтальные чипсы мышечных групп */}
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  onClick={() => { setActiveMuscle(null); setActiveSub(null); }}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all
                    ${!activeMuscle
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-dark-elevated text-dark-muted border-dark-border hover:text-dark-text'}`}
                >
                  Все
                </button>
                {Object.entries(MUSCLE_TREE).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => { setActiveMuscle(activeMuscle === key ? null : key); setActiveSub(null); }}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all
                      ${activeMuscle === key
                        ? 'text-white border-transparent'
                        : 'bg-dark-elevated text-dark-muted border-dark-border hover:text-dark-text'}`}
                    style={activeMuscle === key
                      ? { backgroundColor: info.color, borderColor: info.color }
                      : {}}
                  >
                    {info.label}
                  </button>
                ))}
              </div>

              {search || activeMuscle ? (
                <p className="text-xs text-dark-muted mt-1.5">
                  {filtered.length === 0
                    ? 'Ничего не найдено'
                    : `${filtered.length} упражн${filtered.length === 1 ? 'ение' : filtered.length < 5 ? 'ения' : 'ений'}`}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Список упражнений ── */}
        <div className="overflow-y-auto flex-1 px-3 pb-3 mt-1">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-dark-muted text-sm">Ничего не найдено</p>
              <button onClick={clearFilters}
                className="text-primary-400 text-xs mt-2 hover:text-primary-300 transition-colors">
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map(exercise => {
                const inWorkout = selectedIds.has(exercise.id);
                const inMulti   = multiPicked.has(exercise.id);
                const info      = MUSCLE_TREE[exercise.primary_muscle];

                return (
                  <button
                    key={exercise.id}
                    onClick={() => handleSelect(exercise)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                      ${inWorkout && !multiSelect
                        ? 'bg-primary-600/10 border border-primary-600/20'
                        : inMulti
                          ? 'bg-primary-600/15 border border-primary-500/40'
                          : 'hover:bg-dark-elevated border border-transparent'}`}
                  >
                    {/* Цветовой маркер мышцы */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                      style={{
                        backgroundColor: info ? `${info.color}20` : '#252540',
                        border: `1px solid ${info ? `${info.color}40` : '#2a2a4a'}`,
                      }}
                    >
                      {inMulti || (inWorkout && !multiSelect)
                        ? <Check className="w-4 h-4" style={{ color: info?.color || '#0d9488' }} />
                        : <span>{
                            exercise.primary_muscle === 'chest' ? '💪' :
                            exercise.primary_muscle === 'back' ? '🔙' :
                            exercise.primary_muscle === 'legs' ? '🦵' :
                            exercise.primary_muscle === 'arms' ? '💪' :
                            exercise.primary_muscle === 'shoulders' ? '🏋️' :
                            exercise.primary_muscle === 'core' ? '🎯' : '🏃'
                          }</span>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">
                        {exercise.name_ru}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {info && (
                          <span
                            className="text-xs font-medium"
                            style={{ color: `${info.color}cc` }}
                          >
                            {info.label}
                          </span>
                        )}
                        {exercise.equipment && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-md border
                            ${EQUIPMENT_COLORS[exercise.equipment] || 'bg-dark-elevated text-dark-muted border-dark-border'}`}>
                            {EQUIPMENT_LABELS[exercise.equipment] || exercise.equipment}
                          </span>
                        )}
                      </div>
                    </div>

                    {inWorkout && !multiSelect ? (
                      <span className="text-xs font-medium flex-shrink-0" style={{ color: '#0d9488' }}>
                        в тренировке
                      </span>
                    ) : !multiSelect ? (
                      <ChevronRight className="w-4 h-4 text-dark-muted flex-shrink-0 opacity-40" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Кнопка мультиселекта ── */}
        {multiSelect && multiPicked.size > 0 && (
          <div className="px-4 pb-5 pt-2 border-t border-dark-border flex-shrink-0">
            <button onClick={() => onConfirmMulti?.(exercises.filter(e => multiPicked.has(e.id)))}
              className="btn-primary w-full flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Добавить {multiPicked.size} упражн{multiPicked.size === 1 ? 'ение' : multiPicked.size < 5 ? 'ения' : 'ений'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

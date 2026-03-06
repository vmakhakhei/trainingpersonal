// file: src/pages/AnalyticsPage.jsx
import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Dumbbell, Target,
  Flame, Trophy, Scale, Plus, X, ChevronUp, ChevronDown
} from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  differenceInCalendarDays, parseISO,
  isToday, isYesterday, subDays, format
} from 'date-fns';
import { ru } from 'date-fns/locale';

// ─── Тултипы ─────────────────────────────────────────────────────────────────
function VolumeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl px-3 py-2 shadow-card-md">
      <p className="text-xs text-dark-muted mb-1">Тренировка #{label}</p>
      <p className="text-sm font-semibold">
        {payload[0].value.toLocaleString('ru')}
        <span className="text-dark-muted font-normal ml-1">кг</span>
      </p>
    </div>
  );
}

function WeightTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl px-3 py-2 shadow-card-md">
      <p className="text-xs text-dark-muted mb-1">{label}</p>
      <p className="text-sm font-semibold">
        {payload[0].value}
        <span className="text-dark-muted font-normal ml-1">кг</span>
      </p>
      {payload[1]?.value && (
        <p className="text-xs text-dark-muted">Жир: {payload[1].value}%</p>
      )}
    </div>
  );
}

// ─── Бейджи ──────────────────────────────────────────────────────────────────
function TrendBadge({ data, field = 'volume' }) {
  if (data.length < 2) return null;
  const last = data[data.length - 1]?.[field] ?? 0;
  const prev = data[data.length - 2]?.[field] ?? 0;
  if (!prev) return null;
  const delta = last - prev;
  const pct = Math.abs(Math.round((delta / prev) * 100));

  if (delta > 0) return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3" />+{pct}%
    </span>
  );
  if (delta < 0) return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
      <TrendingDown className="w-3 h-3" />-{pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-dark-muted bg-dark-elevated px-2 py-0.5 rounded-full">
      <Minus className="w-3 h-3" />0%
    </span>
  );
}

function WeightDelta({ data }) {
  if (data.length < 2) return null;
  const delta = +(data[data.length - 1].weight - data[0].weight).toFixed(1);
  if (delta === 0) return null;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${delta < 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
      {delta < 0 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      {delta > 0 ? '+' : ''}{delta} кг за период
    </span>
  );
}

// ─── Стрик ───────────────────────────────────────────────────────────────────
function calcStreak(dates) {
  if (!dates.length) return { current: 0, best: 0 };
  const unique = [...new Set(dates.map(d => d.split('T')[0]))].sort((a, b) => b.localeCompare(a));

  let current = 0;
  if (isToday(parseISO(unique[0])) || isYesterday(parseISO(unique[0]))) {
    current = 1;
    for (let i = 1; i < unique.length; i++) {
      if (differenceInCalendarDays(parseISO(unique[i - 1]), parseISO(unique[i])) === 1) current++;
      else break;
    }
  }

  let best = current, run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (differenceInCalendarDays(parseISO(unique[i - 1]), parseISO(unique[i])) === 1) {
      run++; if (run > best) best = run;
    } else run = 1;
  }
  return { current, best };
}

// ─── Модал ввода веса ─────────────────────────────────────────────────────────
function WeightModal({ onClose, onSaved }) {
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const w = parseFloat(weight);
    if (!w || w < 20 || w > 300) { setError('Введи корректный вес (20–300 кг)'); return; }
    try {
      setSaving(true);
      setError('');
      const { error: err } = await supabase
        .from('weight_logs')
        .upsert({
          user_id: SINGLE_USER_ID,
          log_date: new Date().toISOString().split('T')[0],
          weight_kg: w,
          body_fat_percentage: fat ? parseFloat(fat) : null,
          notes: notes.trim() || null,
          is_deleted: false,
        }, { onConflict: 'user_id,log_date' });
      if (err) throw err;
      onSaved();
      onClose();
    } catch (e) {
      setError('Ошибка сохранения. Попробуй ещё раз.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-dark-surface rounded-t-2xl border-t border-dark-border p-5 pb-8 animate-slide-up">
        <div className="w-10 h-1 bg-dark-border rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Записать вес</h2>
          <button onClick={onClose} className="quick-action text-dark-muted"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-dark-muted mb-4">{format(new Date(), 'd MMMM yyyy', { locale: ru })}</p>

        <div className="mb-4">
          <label className="text-sm text-dark-muted mb-2 block">Вес тела <span className="text-red-400">*</span></label>
          <div className="relative">
            <input type="number" inputMode="decimal" step="0.1" placeholder="75.0"
              value={weight} onChange={e => setWeight(e.target.value)}
              className="input-field w-full pr-12" autoFocus />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-muted text-sm">кг</span>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-sm text-dark-muted mb-2 block">
            % жира <span className="text-dark-subtle text-xs">(необязательно)</span>
          </label>
          <div className="relative">
            <input type="number" inputMode="decimal" step="0.1" placeholder="18.0"
              value={fat} onChange={e => setFat(e.target.value)}
              className="input-field w-full pr-8" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-muted text-sm">%</span>
          </div>
        </div>
        <div className="mb-5">
          <label className="text-sm text-dark-muted mb-2 block">
            Заметка <span className="text-dark-subtle text-xs">(необязательно)</span>
          </label>
          <input type="text" placeholder="После завтрака, до тренировки..."
            value={notes} onChange={e => setNotes(e.target.value)}
            className="input-field w-full" />
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <button onClick={handleSave} disabled={saving || !weight} className="btn-primary w-full">
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [stats, setStats] = useState({ totalWorkouts: 0, totalVolume: 0, avgVolume: 0 });
  const [volumeData, setVolumeData] = useState([]);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [prs, setPrs] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [latestWeight, setLatestWeight] = useState(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [showWeightModal, setShowWeightModal] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const since = subDays(new Date(), period).toISOString().split('T')[0];

      // 1. Тренировки за период
      const { data: workouts } = await supabase
        .from('workouts')
        .select('id, workout_date, total_volume_kg')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .gte('workout_date', since)
        .order('workout_date', { ascending: true });

      const ws = workouts || [];
      const totalVol = ws.reduce((s, w) => s + (parseFloat(w.total_volume_kg) || 0), 0);
      setStats({ totalWorkouts: ws.length, totalVolume: totalVol, avgVolume: ws.length ? totalVol / ws.length : 0 });
      setVolumeData(ws.map((w, i) => ({
        index: i + 1,
        volume: Math.round(parseFloat(w.total_volume_kg) || 0),
        date: format(parseISO(w.workout_date), 'd MMM', { locale: ru }),
      })));

      // 2. Стрик
      const { data: allDates } = await supabase
        .from('workouts').select('workout_date')
        .eq('user_id', SINGLE_USER_ID).eq('is_deleted', false)
        .order('workout_date', { ascending: false });
      setStreak(calcStreak((allDates || []).map(r => r.workout_date)));

      // 3. PR через exercise_progress view
      const { data: progress } = await supabase
        .from('exercise_progress')
        .select('exercise_name, weight_kg, reps, estimated_1rm')
        .eq('user_id', SINGLE_USER_ID)
        .gt('weight_kg', 0)
        .order('weight_kg', { ascending: false });

      if (progress?.length) {
        const prMap = {};
        progress.forEach(row => {
          const name = row.exercise_name || 'Упражнение';
          const w = parseFloat(row.weight_kg) || 0;
          if (!prMap[name] || w > prMap[name].maxWeight) {
            prMap[name] = {
              exercise: name,
              maxWeight: w,
              reps: row.reps,
              estimated1rm: row.estimated_1rm ? Math.round(parseFloat(row.estimated_1rm)) : null,
            };
          }
        });
        setPrs(Object.values(prMap).sort((a, b) => b.maxWeight - a.maxWeight).slice(0, 5));
      } else {
        setPrs([]);
      }

      // 4. Вес тела за период
      const { data: weights } = await supabase
        .from('weight_logs')
        .select('log_date, weight_kg, body_fat_percentage')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .gte('log_date', since)
        .order('log_date', { ascending: true });

      setWeightData((weights || []).map(r => ({
        date: r.log_date,
        label: format(parseISO(r.log_date), 'd MMM', { locale: ru }),
        weight: parseFloat(r.weight_kg),
        fat: r.body_fat_percentage ? parseFloat(r.body_fat_percentage) : null,
      })));

      // ─── ФИКС: убрал .single() — используем массив + [0] ─────────────────
      // .single() падает с PGRST116 если строк 0 (таблица пустая)
      const { data: latestArr } = await supabase
        .from('weight_logs')
        .select('log_date, weight_kg, body_fat_percentage')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .order('log_date', { ascending: false })
        .limit(1);

      setLatestWeight(latestArr?.[0] ?? null);

    } catch (err) {
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const avgVolLine = volumeData.length
    ? Math.round(volumeData.reduce((s, d) => s + d.volume, 0) / volumeData.length)
    : null;

  const weightWithMA = weightData.map((d, i) => {
    if (weightData.length < 3 || i < 1) return d;
    const slice = weightData.slice(Math.max(0, i - 1), i + 2);
    return { ...d, ma: +(slice.reduce((s, x) => s + x.weight, 0) / slice.length).toFixed(1) };
  });

  const weightYDomain = weightData.length
    ? [Math.floor(Math.min(...weightData.map(d => d.weight)) - 2),
    Math.ceil(Math.max(...weightData.map(d => d.weight)) + 2)]
    : ['auto', 'auto'];

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse h-24 bg-dark-surface rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-5 pb-6">

        {/* Заголовок + период */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Аналитика</h1>
          <div className="flex gap-1 bg-dark-surface rounded-lg p-1 border border-dark-border">
            {[{ v: 30, l: '1М' }, { v: 90, l: '3М' }, { v: 365, l: '1Г' }].map(({ v, l }) => (
              <button key={v} onClick={() => setPeriod(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${period === v ? 'bg-primary-600 text-white' : 'text-dark-muted hover:text-dark-text'
                  }`}>{l}</button>
            ))}
          </div>
        </div>

        {/* Стрик */}
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
            <Flame className="w-6 h-6 text-orange-400" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-dark-muted mb-0.5">Текущая серия</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{streak.current}</span>
              <span className="text-dark-muted text-sm">дней подряд</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-dark-muted mb-0.5">Рекорд</div>
            <div className="text-xl font-bold text-primary-500">{streak.best}</div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card">
            <Dumbbell className="w-4 h-4 text-primary-500 mb-2" />
            <div className="text-xl font-bold">{stats.totalWorkouts}</div>
            <div className="text-xs text-dark-muted mt-0.5">тренировок</div>
          </div>
          <div className="card">
            <TrendingUp className="w-4 h-4 text-primary-500 mb-2" />
            <div className="text-xl font-bold">
              {stats.totalVolume >= 1000
                ? `${(stats.totalVolume / 1000).toFixed(1)}т`
                : Math.round(stats.totalVolume)}
            </div>
            <div className="text-xs text-dark-muted mt-0.5">
              {stats.totalVolume >= 1000 ? 'тонн объёма' : 'кг объёма'}
            </div>
          </div>
          <div className="card">
            <Target className="w-4 h-4 text-primary-500 mb-2" />
            <div className="text-xl font-bold">{Math.round(stats.avgVolume)}</div>
            <div className="text-xs text-dark-muted mt-0.5">кг/трен.</div>
          </div>
        </div>

        {/* Вес тела */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary-500" />
              <div>
                <h2 className="font-semibold leading-tight">Вес тела</h2>
                {latestWeight && (
                  <p className="text-xs text-dark-muted">
                    Последнее: {parseFloat(latestWeight.weight_kg)} кг
                    {latestWeight.body_fat_percentage && ` · ${parseFloat(latestWeight.body_fat_percentage)}% жира`}
                    {` · ${format(parseISO(latestWeight.log_date), 'd MMM', { locale: ru })}`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WeightDelta data={weightData} />
              <button
                onClick={() => setShowWeightModal(true)}
                className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700
                           text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />Записать
              </button>
            </div>
          </div>

          {weightData.length >= 2 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightWithMA} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--color-muted)" tick={{ fontSize: 11 }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--color-muted)" tick={{ fontSize: 11 }}
                    tickLine={false} axisLine={false} domain={weightYDomain} />
                  <Tooltip content={<WeightTooltip />} />
                  <Line type="monotone" dataKey="weight" stroke="var(--color-primary-500)"
                    strokeWidth={1.5} strokeDasharray="4 2"
                    dot={{ fill: 'var(--color-primary-600)', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }} name="Вес" />
                  {weightData.length >= 3 && (
                    <Line type="monotone" dataKey="ma" stroke="var(--color-primary-600)"
                      strokeWidth={2.5} dot={false} activeDot={false} name="Тренд" />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-dark-border">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 border-t-2 border-dashed border-primary-500/70" />
                  <span className="text-xs text-dark-muted">Измерения</span>
                </div>
                {weightData.length >= 3 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 border-t-2 border-primary-600" />
                    <span className="text-xs text-dark-muted">Тренд (MA3)</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-8 text-dark-muted text-sm gap-2">
              <Scale className="w-8 h-8 opacity-30" />
              <p>{weightData.length === 1 ? 'Нужна ещё одна запись для графика' : 'Нет записей за этот период'}</p>
              {weightData.length === 0 && (
                <button onClick={() => setShowWeightModal(true)}
                  className="text-primary-500 text-xs hover:text-primary-400 transition-colors">
                  Добавить первую запись →
                </button>
              )}
            </div>
          )}
        </div>

        {/* График объёма */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Объём тренировок</h2>
              <p className="text-xs text-dark-muted mt-0.5">Суммарный вес за тренировку</p>
            </div>
            <TrendBadge data={volumeData} field="volume" />
          </div>

          {volumeData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={volumeData} margin={{ top: 8, right: 12, left: -20, bottom: 16 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--color-primary-600)" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="index" stroke="var(--color-muted)" tick={{ fontSize: 11 }}
                  tickLine={false} axisLine={false}
                  label={{ value: '# тренировка', position: 'insideBottom', offset: -10, fontSize: 10, fill: 'var(--color-muted)' }} />
                <YAxis stroke="var(--color-muted)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}т` : v} />
                {avgVolLine && (
                  <ReferenceLine y={avgVolLine} stroke="var(--color-muted)" strokeDasharray="4 4"
                    label={{ value: 'avg', position: 'insideTopRight', fontSize: 10, fill: 'var(--color-muted)' }} />
                )}
                <Tooltip content={<VolumeTooltip />} />
                <Line type="monotone" dataKey="volume" stroke="url(#volGrad)" strokeWidth={2.5}
                  dot={{ fill: 'var(--color-primary-600)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--color-primary-500)', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10 text-dark-muted text-sm">
              {volumeData.length === 1 ? 'Нужна ещё минимум 1 тренировка' : 'Нет тренировок за этот период'}
            </div>
          )}
        </div>

        {/* Личные рекорды */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold">Личные рекорды</h2>
          </div>
          {prs.length > 0 ? (
            <div className="space-y-2">
              {prs.map((pr, i) => (
                <div key={pr.exercise}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-dark-elevated border border-dark-border">
                  <span className="text-base w-6 text-center flex-shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉'
                      : <span className="text-xs text-dark-muted font-bold">{i + 1}</span>}
                  </span>
                  <span className="flex-1 text-sm truncate">{pr.exercise}</span>
                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-bold">{pr.maxWeight}</span>
                    <span className="text-xs text-dark-muted ml-1">кг</span>
                    {pr.reps && <span className="text-xs text-dark-muted ml-1">× {pr.reps}</span>}
                    {pr.estimated1rm && (
                      <div className="text-xs text-primary-500">1RM ≈ {pr.estimated1rm} кг</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-dark-muted text-sm">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Рекорды появятся после тренировок
            </div>
          )}
        </div>

      </div>

      {showWeightModal && (
        <WeightModal onClose={() => setShowWeightModal(false)} onSaved={loadAnalytics} />
      )}
    </>
  );
}

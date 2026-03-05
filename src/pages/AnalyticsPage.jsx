// file: src/pages/AnalyticsPage.jsx
import { useEffect, useState } from 'react';
import { TrendingUp, Dumbbell, Target } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    avgVolume: 0
  });
  const [volumeData, setVolumeData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);

      // Источник: core_features.progress_tracking - графики прогресса, volume
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];

      const { data: workouts, error } = await supabase
        .from('workouts')
        .select('workout_date, total_volume_kg')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .gte('workout_date', thirtyDaysAgo)
        .order('workout_date');

      if (error) throw error;

      const workoutsData = workouts || [];

      // Stats
      const totalVol = workoutsData.reduce((sum, w) => sum + (parseFloat(w.total_volume_kg) || 0), 0);
      setStats({
        totalWorkouts: workoutsData.length,
        totalVolume: totalVol,
        avgVolume: workoutsData.length > 0 ? totalVol / workoutsData.length : 0
      });

      // Chart data
      const chartData = workoutsData.map(w => ({
        date: format(new Date(w.workout_date), 'd MMM', { locale: ru }),
        volume: Math.round(parseFloat(w.total_volume_kg) || 0)
      }));
      setVolumeData(chartData);

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-dark-surface rounded-xl"></div>
          <div className="h-64 bg-dark-surface rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Аналитика</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center space-x-2 mb-2">
            <Dumbbell className="w-4 h-4 text-primary-500" />
            <span className="text-xs text-dark-muted">Тренировок</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalWorkouts}</div>
          <div className="text-xs text-dark-muted">за 30 дней</div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            <span className="text-xs text-dark-muted">Объём</span>
          </div>
          <div className="text-2xl font-bold">{Math.round(stats.totalVolume)}</div>
          <div className="text-xs text-dark-muted">кг всего</div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-4 h-4 text-primary-500" />
            <span className="text-xs text-dark-muted">Средний</span>
          </div>
          <div className="text-2xl font-bold">{Math.round(stats.avgVolume)}</div>
          <div className="text-xs text-dark-muted">кг/тренировка</div>
        </div>
      </div>

      {/* Volume Chart - Источник: competitors - Strong, Hevy (графики) */}
      <div className="card">
        <h2 className="font-semibold mb-4">Объём тренировок</h2>
        {volumeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" stroke="#a3a3a3" style={{ fontSize: '12px' }} />
              <YAxis stroke="#a3a3a3" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px'
                }}
              />
              <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-dark-muted">
            Недостаточно данных для графика
          </div>
        )}
      </div>
    </div>
  );
}

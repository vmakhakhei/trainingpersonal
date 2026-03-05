// file: src/pages/DashboardPage.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, TrendingUp, Dumbbell, Calendar } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function DashboardPage() {
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    thisWeekWorkouts: 0,
    totalVolume: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      // Источник: competitors - Strong, Hevy (dashboard with recent workouts)
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select('*, sets(count)')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .order('workout_date', { ascending: false })
        .limit(5);

      if (error) throw error;

      setRecentWorkouts(workouts || []);

      // Calculate stats
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const thisWeek = workouts?.filter(
        w => new Date(w.workout_date) >= weekAgo
      ).length || 0;

      const totalVol = workouts?.reduce(
        (sum, w) => sum + (parseFloat(w.total_volume_kg) || 0), 0
      ) || 0;

      setStats({
        totalWorkouts: workouts?.length || 0,
        thisWeekWorkouts: thisWeek,
        totalVolume: totalVol
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-dark-surface rounded-xl"></div>
          <div className="h-48 bg-dark-surface rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-dark-muted mt-1">
          {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
        </p>
      </div>

      {/* Quick Actions - Источник: ux_guidelines - минимизация кликов */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/log-workout" className="card hover:bg-dark-elevated transition-colors">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-primary-600 rounded-lg">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-medium">Начать</div>
              <div className="text-sm text-dark-muted">тренировку</div>
            </div>
          </div>
        </Link>

        <Link to="/analytics" className="card hover:bg-dark-elevated transition-colors">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-primary-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-medium">Прогресс</div>
              <div className="text-sm text-dark-muted">аналитика</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="text-dark-muted text-sm mb-1">Всего</div>
          <div className="text-2xl font-bold">{stats.totalWorkouts}</div>
          <div className="text-xs text-dark-muted">тренировок</div>
        </div>

        <div className="card">
          <div className="text-dark-muted text-sm mb-1">За неделю</div>
          <div className="text-2xl font-bold">{stats.thisWeekWorkouts}</div>
          <div className="text-xs text-dark-muted">тренировок</div>
        </div>

        <div className="card">
          <div className="text-dark-muted text-sm mb-1">Объём</div>
          <div className="text-2xl font-bold">{Math.round(stats.totalVolume)}</div>
          <div className="text-xs text-dark-muted">кг</div>
        </div>
      </div>

      {/* Recent Workouts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Последние тренировки</h2>
          <Link to="/workouts" className="text-primary-500 text-sm">
            Все →
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="card text-center py-8">
            <Dumbbell className="w-12 h-12 mx-auto text-dark-muted mb-3" />
            <p className="text-dark-muted">Нет тренировок</p>
            <Link to="/log-workout" className="btn-primary mt-4 inline-block">
              Начать первую тренировку
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentWorkouts.map(workout => (
              <Link
                key={workout.id}
                to={`/workouts/${workout.id}`}
                className="card hover:bg-dark-elevated transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-dark-elevated rounded">
                      <Calendar className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {format(new Date(workout.workout_date), 'd MMMM', { locale: ru })}
                      </div>
                      <div className="text-sm text-dark-muted">
                        {workout.sets?.[0]?.count || 0} подходов
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{Math.round(workout.total_volume_kg || 0)} кг</div>
                    <div className="text-xs text-dark-muted">объём</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

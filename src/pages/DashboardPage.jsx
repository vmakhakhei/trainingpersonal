import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, TrendingUp, Dumbbell, Calendar } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

function buildWorkoutStats(sets = []) {
  const stats = new Map();

  for (const set of sets) {
    const workoutId = set.workout_id;
    if (!workoutId) continue;

    const prev = stats.get(workoutId) || { set_count: 0, volume_kg: 0 };
    const weight = Number(set.weight_kg) || 0;
    const reps = Number(set.reps) || 0;
    const isWarmup = Boolean(set.is_warmup);

    stats.set(workoutId, {
      set_count: prev.set_count + 1,
      volume_kg: prev.volume_kg + (isWarmup ? 0 : weight * reps)
    });
  }

  return stats;
}

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

      const { data: workoutRows, error: workoutsError } = await supabase
        .from('workouts')
        .select('id, workout_date, total_volume_kg, created_at')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (workoutsError) throw workoutsError;

      const workoutIds = (workoutRows || []).map((item) => item.id);
      let statsByWorkout = new Map();

      if (workoutIds.length > 0) {
        const { data: setRows, error: setsError } = await supabase
          .from('sets')
          .select('workout_id, weight_kg, reps, is_warmup')
          .in('workout_id', workoutIds)
          .eq('is_deleted', false);

        if (setsError) throw setsError;

        statsByWorkout = buildWorkoutStats(setRows || []);
      }

      const completedWorkouts = (workoutRows || [])
        .map((workout) => {
          const summary = statsByWorkout.get(workout.id) || { set_count: 0, volume_kg: 0 };
          const fallbackVolume = Number(workout.total_volume_kg) || 0;

          return {
            ...workout,
            set_count: summary.set_count,
            display_volume_kg: summary.volume_kg > 0 ? summary.volume_kg : fallbackVolume
          };
        })
        .filter((workout) => workout.set_count > 0);

      setRecentWorkouts(completedWorkouts.slice(0, 5));

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const thisWeek = completedWorkouts.filter(
        (workout) => new Date(workout.workout_date) >= weekAgo
      ).length;

      const totalVol = completedWorkouts.reduce(
        (sum, workout) => sum + (Number(workout.display_volume_kg) || 0),
        0
      );

      setStats({
        totalWorkouts: completedWorkouts.length,
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
        <p className="text-dark-muted mt-1">{format(new Date(), 'EEEE, d MMMM', { locale: ru })}</p>
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
            {recentWorkouts.map((workout) => (
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
                      <div className="text-sm text-dark-muted">{workout.set_count} подходов</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {Math.round(workout.display_volume_kg || 0)} кг
                    </div>
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

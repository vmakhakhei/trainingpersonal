// file: src/pages/WorkoutsPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, TrendingUp, Trash2 } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkouts();
  }, []);

  async function loadWorkouts() {
    try {
      setLoading(true);
      // Источник: competitors - Strong, Hevy (workout history)
      const { data, error } = await supabase
        .from('workouts')
        .select('*, sets(count)')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .order('workout_date', { ascending: false });

      if (error) throw error;
      setWorkouts(data || []);
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteWorkout(id) {
    if (!confirm('Удалить тренировку?')) return;

    try {
      // Источник: требования - soft-delete
      const { error } = await supabase
        .from('workouts')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: SINGLE_USER_ID
        })
        .eq('id', id);

      if (error) throw error;
      loadWorkouts();
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('Ошибка удаления');
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-dark-surface rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">История тренировок</h1>

      {workouts.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="w-16 h-16 mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted mb-4">Нет тренировок</p>
          <Link to="/log-workout" className="btn-primary inline-block">
            Начать тренировку
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map(workout => (
            <div key={workout.id} className="card">
              <Link to={`/workouts/${workout.id}`} className="block">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-lg">
                      {format(new Date(workout.workout_date), 'd MMMM yyyy', { locale: ru })}
                    </div>
                    <div className="text-sm text-dark-muted">
                      {workout.sets?.[0]?.count || 0} подходов
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary-500">
                      {Math.round(workout.total_volume_kg || 0)} кг
                    </div>
                    <div className="text-xs text-dark-muted">объём</div>
                  </div>
                </div>
              </Link>

              <div className="flex items-center justify-between pt-3 border-t border-dark-border">
                <Link to={`/workouts/${workout.id}`} className="text-primary-500 text-sm">
                  Подробнее →
                </Link>
                <button
                  onClick={() => deleteWorkout(workout.id)}
                  className="p-2 hover:bg-dark-elevated rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-error" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
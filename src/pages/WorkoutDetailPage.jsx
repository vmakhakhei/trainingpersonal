import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, Clock3, Dumbbell, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';

function formatDuration(startTime, endTime) {
  if (!startTime || !endTime) {
    return '—';
  }

  const startedAt = new Date(startTime);
  const endedAt = new Date(endTime);
  const minutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));

  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} ч ${remainingMinutes} мин`;
}

function computeVolume(sets = []) {
  return sets.reduce((sum, set) => {
    const weight = Number(set.weight_kg) || 0;
    const reps = Number(set.reps) || 0;
    return sum + weight * reps;
  }, 0);
}

export default function WorkoutDetailPage() {
  const { id } = useParams();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWorkoutDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error: loadError } = await supabase
        .from('workouts')
        .select(`
          id,
          workout_date,
          start_time,
          end_time,
          notes,
          mood,
          energy_level,
          total_volume_kg,
          sets (
            id,
            exercise_id,
            set_order,
            weight_kg,
            reps,
            rpe,
            is_warmup,
            notes,
            created_at,
            exercises (
              id,
              name_ru,
              primary_muscle
            )
          )
        `)
        .eq('id', id)
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .single();

      if (loadError) {
        throw loadError;
      }

      const normalizedSets = Array.isArray(data?.sets)
        ? [...data.sets].sort((a, b) => a.set_order - b.set_order)
        : [];

      setWorkout({
        ...data,
        sets: normalizedSets
      });
    } catch (loadError) {
      console.error('Error loading workout details:', loadError);
      setError(loadError.message || 'Не удалось загрузить тренировку');
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadWorkoutDetails();
  }, [loadWorkoutDetails]);

  const sets = useMemo(() => (Array.isArray(workout?.sets) ? workout.sets : []), [workout]);

  const groupedByExercise = useMemo(() => {
    const map = new Map();

    for (const set of sets) {
      const key = set.exercise_id || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          exerciseId: key,
          name: set.exercises?.name_ru || 'Упражнение',
          muscle: set.exercises?.primary_muscle || '—',
          sets: []
        });
      }

      map.get(key).sets.push(set);
    }

    return Array.from(map.values()).map((item) => ({
      ...item,
      volume: computeVolume(item.sets)
    }));
  }, [sets]);

  const calculatedVolume = computeVolume(sets);
  const workoutVolume = Math.round(calculatedVolume || Number(workout?.total_volume_kg) || 0);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse h-40 bg-dark-surface rounded-xl" />
        <div className="animate-pulse h-28 bg-dark-surface rounded-xl" />
        <div className="animate-pulse h-28 bg-dark-surface rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-4">
        <div className="card-elevated">
          <h1 className="text-xl font-semibold text-dark-text">Детали тренировки</h1>
          <p className="text-sm text-error mt-2">{error}</p>
        </div>

        <Link to="/workouts" className="btn-secondary inline-flex items-center">
          Назад к тренировкам
        </Link>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="p-4 space-y-4">
        <div className="card-elevated">
          <h1 className="text-xl font-semibold text-dark-text">Тренировка не найдена</h1>
        </div>

        <Link to="/workouts" className="btn-secondary inline-flex items-center">
          Назад к тренировкам
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="card-elevated space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-dark-text">Детали тренировки</h1>
          <p className="text-sm text-dark-muted mt-2">
            {format(new Date(workout.workout_date), 'd MMMM yyyy', { locale: ru })}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card">
            <div className="flex items-center gap-2 text-xs text-dark-muted mb-1">
              <Dumbbell className="w-4 h-4" />
              Подходов
            </div>
            <div className="font-semibold">{sets.length}</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-xs text-dark-muted mb-1">
              <Target className="w-4 h-4" />
              Объём
            </div>
            <div className="font-semibold">{workoutVolume} кг</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-xs text-dark-muted mb-1">
              <Clock3 className="w-4 h-4" />
              Длительность
            </div>
            <div className="font-semibold">{formatDuration(workout.start_time, workout.end_time)}</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-xs text-dark-muted mb-1">
              <Calendar className="w-4 h-4" />
              Статус
            </div>
            <div className="font-semibold">{workout.end_time ? 'Завершена' : 'В процессе'}</div>
          </div>
        </div>

        {workout.notes && (
          <div className="text-sm text-dark-muted border-t border-dark-border pt-3">
            <span className="text-dark-text font-medium">Заметки: </span>
            {workout.notes}
          </div>
        )}
      </div>

      {groupedByExercise.length === 0 ? (
        <div className="card text-dark-muted">В этой тренировке пока нет подходов.</div>
      ) : (
        groupedByExercise.map((exerciseGroup) => (
          <div key={exerciseGroup.exerciseId} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{exerciseGroup.name}</div>
                <div className="text-xs text-dark-muted">{exerciseGroup.muscle}</div>
              </div>
              <div className="text-sm text-dark-muted">{Math.round(exerciseGroup.volume)} кг объём</div>
            </div>

            <div className="space-y-2">
              {exerciseGroup.sets.map((set) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between rounded-lg border border-dark-border bg-dark-elevated px-3 py-2"
                >
                  <div className="text-sm text-dark-muted">#{set.set_order}</div>
                  <div className="font-medium">{set.weight_kg} кг × {set.reps}</div>
                  <div className="text-sm text-dark-muted">RPE: {set.rpe ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <Link to="/workouts" className="btn-secondary inline-flex items-center">
        Назад к тренировкам
      </Link>
    </div>
  );
}

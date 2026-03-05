import { supabaseAdmin } from './supabase.js';

async function getWorkoutSummary(userId, args) {
  const { data, error } = await supabaseAdmin
    .from('recent_workouts_summary')
    .select('*')
    .eq('user_id', userId)
    .order('workout_date', { ascending: false })
    .limit(args.limit);

  if (error) {
    throw error;
  }

  return data || [];
}

async function getExerciseProgress(userId, args) {
  const { data, error } = await supabaseAdmin
    .from('exercise_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_id', args.exercise_id)
    .order('workout_date', { ascending: false })
    .limit(args.limit);

  if (error) {
    throw error;
  }

  return data || [];
}

async function listRecentWorkouts(userId, args) {
  const { data, error } = await supabaseAdmin
    .from('workouts')
    .select(
      'id, workout_date, total_volume_kg, mood, energy_level, start_time, end_time, notes, created_at, updated_at'
    )
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('workout_date', { ascending: false })
    .limit(args.limit);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function executeTool({ tool, args, userId }) {
  if (tool === 'get_workout_summary') {
    return getWorkoutSummary(userId, args);
  }

  if (tool === 'get_exercise_progress') {
    return getExerciseProgress(userId, args);
  }

  if (tool === 'list_recent_workouts') {
    return listRecentWorkouts(userId, args);
  }

  throw new Error(`Tool executor not implemented for: ${tool}`);
}

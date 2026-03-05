export async function getWorkoutHistory({ supabaseAdmin, userId, args }) {
  const { data, error } = await supabaseAdmin
    .from('workouts')
    .select('id, workout_date, total_volume_kg, mood, energy_level, start_time, end_time, notes, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('workout_date', { ascending: false })
    .limit(args.limit);

  if (error) {
    throw error;
  }

  return {
    items: data || []
  };
}

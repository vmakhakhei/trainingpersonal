export async function getExerciseProgress({ supabaseAdmin, userId, args }) {
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

  return {
    exercise_id: args.exercise_id,
    items: data || []
  };
}

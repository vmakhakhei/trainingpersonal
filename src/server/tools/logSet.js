export async function logSet({ supabaseAdmin, userId, args }) {
  const workoutLookup = await supabaseAdmin
    .from('workouts')
    .select('id')
    .eq('id', args.workout_id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .single();

  if (workoutLookup.error || !workoutLookup.data) {
    throw new Error('Workout not found or access denied');
  }

  const lastSetQuery = await supabaseAdmin
    .from('sets')
    .select('set_order')
    .eq('workout_id', args.workout_id)
    .eq('exercise_id', args.exercise_id)
    .order('set_order', { ascending: false })
    .limit(1);

  if (lastSetQuery.error) {
    throw lastSetQuery.error;
  }

  const previousSetOrder = lastSetQuery.data?.[0]?.set_order || 0;
  const setOrder = previousSetOrder + 1;

  const insertResult = await supabaseAdmin
    .from('sets')
    .insert({
      workout_id: args.workout_id,
      exercise_id: args.exercise_id,
      set_order: setOrder,
      weight_kg: args.weight_kg,
      reps: args.reps,
      rpe: args.rpe ?? null,
      is_warmup: false
    })
    .select()
    .single();

  if (insertResult.error) {
    throw insertResult.error;
  }

  return {
    set_order: setOrder,
    set: insertResult.data
  };
}

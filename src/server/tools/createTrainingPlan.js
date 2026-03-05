export async function createTrainingPlan({ supabaseAdmin, userId, args }) {
  const insertPayload = {
    user_id: userId,
    name: args.name,
    description: args.description || null,
    goal: args.goal || null,
    days_per_week: args.days_per_week,
    duration_weeks: args.duration_weeks
  };

  const { data, error } = await supabaseAdmin
    .from('workout_plans')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    plan: data
  };
}

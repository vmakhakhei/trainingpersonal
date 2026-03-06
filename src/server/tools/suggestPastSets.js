export async function suggestPastSets({ supabaseAdmin, userId, args }) {
    const { exercise_id, exclude_set_ids = [], limit_workouts = 3 } = args;

    // 1. Найти последние тренировки, где было это упражнение
    const { data: workoutsData, error: workoutsError } = await supabaseAdmin
        .from('sets')
        .select('workout_id, workouts!inner(workout_date)')
        .eq('exercise_id', exercise_id)
        .eq('user_id', userId)
        .order('workouts.workout_date', { ascending: false })
        .limit(limit_workouts * 5); // Берем больше, чтобы учесть возможные дубли

    if (workoutsError) {
        throw workoutsError;
    }

    // Уникальные workout_id, сохраняя порядок по дате
    const uniqueWorkoutIds = [...new Set(workoutsData.map(row => row.workout_id))].slice(0, limit_workouts);

    if (uniqueWorkoutIds.length === 0) {
        return { suggestions: [] };
    }

    // 2. Получить все подходы из этих тренировок для данного упражнения
    const { data: setsData, error: setsError } = await supabaseAdmin
        .from('sets')
        .select('id, weight_kg, reps, rpe, set_order, workout_id, workouts!inner(workout_date)')
        .eq('exercise_id', exercise_id)
        .eq('user_id', userId)
        .in('workout_id', uniqueWorkoutIds)
        .order('workouts.workout_date', { ascending: false })
        .order('set_order', { ascending: true });

    if (setsError) {
        throw setsError;
    }

    // 3. Отфильтровать исключенные подходы
    const filteredSets = setsData.filter(set => !exclude_set_ids.includes(set.id));

    // 4. Сгруппировать по дате тренировки для удобства
    const groupedByDate = filteredSets.reduce((acc, set) => {
        const date = set.workouts.workout_date;
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push({
            id: set.id,
            weight_kg: set.weight_kg,
            reps: set.reps,
            rpe: set.rpe,
            set_order: set.set_order,
            workout_id: set.workout_id
        });
        return acc;
    }, {});

    // 5. Преобразовать в массив предложений (один подход = одно предложение)
    const suggestions = filteredSets.map(set => ({
        type: 'past_set',
        payload: {
            weight_kg: set.weight_kg,
            reps: set.reps,
            rpe: set.rpe,
            set_order: set.set_order,
            workout_id: set.workout_id,
            workout_date: set.workouts.workout_date
        },
        explain: `Подход ${set.set_order} от ${new Date(set.workouts.workout_date).toLocaleDateString('ru-RU')}`,
        confidence: 1.0
    }));

    return {
        suggestions,
        grouped_by_date: groupedByDate,
        total_suggestions: suggestions.length
    };
}
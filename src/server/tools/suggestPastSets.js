export async function suggestPastSets({ supabaseAdmin, userId, args }) {
    const { exercise_id, exclude_set_ids = [], limit_workouts = 3 } = args;

    // 1. Найти последнюю тренировку, где было это упражнение
    const { data: workoutsData, error: workoutsError } = await supabaseAdmin
        .from('sets')
        .select('workout_id, workouts!inner(workout_date)')
        .eq('exercise_id', exercise_id)
        .eq('user_id', userId)
        .order('workouts(workout_date)', { ascending: false })
        .limit(1); // Только последняя тренировка

    if (workoutsError) {
        throw workoutsError;
    }

    if (!workoutsData || workoutsData.length === 0) {
        return { suggestions: [] };
    }

    const lastWorkoutId = workoutsData[0].workout_id;

    // 2. Получить все подходы из этой тренировки для данного упражнения
    const { data: setsData, error: setsError } = await supabaseAdmin
        .from('sets')
        .select('id, weight_kg, reps, rpe, set_order, workout_id, workouts!inner(workout_date)')
        .eq('exercise_id', exercise_id)
        .eq('user_id', userId)
        .eq('workout_id', lastWorkoutId)
        .order('set_order', { ascending: true });

    if (setsError) {
        throw setsError;
    }

    // 3. Отфильтровать исключенные подходы
    const filteredSets = setsData.filter(set => !exclude_set_ids.includes(set.id));

    // 4. Сгруппировать по дате тренировки для удобства (оставляем для совместимости)
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

    // 5. Возвращаем массив подходов в порядке set_order
    const past_sets = filteredSets.map(set => ({
        weight_kg: set.weight_kg,
        reps: set.reps,
        rpe: set.rpe,
        set_order: set.set_order,
        workout_id: set.workout_id,
        workout_date: set.workouts.workout_date
    }));

    return {
        past_sets, // Основной массив подходов
        suggestions: past_sets.map((set, index) => ({
            type: 'past_set',
            payload: set,
            explain: `Подход ${set.set_order} от ${new Date(set.workout_date).toLocaleDateString('ru-RU')}`,
            confidence: 1.0
        })), // Для обратной совместимости
        grouped_by_date: groupedByDate,
        total_sets: past_sets.length
    };
}
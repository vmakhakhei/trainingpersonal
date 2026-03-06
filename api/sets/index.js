// file: api/sets/index.js
import { supabaseAdmin, validateRequired, validatePositive } from '../_lib/supabase.js';
import { getUserId, handleOptions } from '../_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return handleOptions(res);
  }

  try {
    const userId = getUserId(req);

    if (req.method === 'GET') {
      const { exercise_id } = req.query;

      if (!exercise_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing exercise_id query parameter'
        });
      }

      // Получаем подходы для данного упражнения, сгруппированные по дате тренировки
      const { data, error } = await supabaseAdmin
        .from('sets')
        .select(`
          id,
          weight_kg,
          reps,
          rpe,
          set_order,
          workout_id,
          workouts!inner (
            workout_date
          )
        `)
        .eq('exercise_id', exercise_id)
        .eq('user_id', userId)
        .order('workouts.workout_date', { ascending: false })
        .order('set_order', { ascending: true });

      if (error) throw error;

      // Группируем по дате тренировки
      const groupedByDate = data.reduce((acc, set) => {
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

      return res.status(200).json({
        success: true,
        data: groupedByDate,
        total_sets: data.length
      });
    }

    if (req.method === 'POST') {
      // Источник validation: CONSTRAINTS - reps>=1, weight>=0
      const { workout_id, exercise_id, set_order, weight_kg, reps, rpe, is_warmup, notes } = req.body;

      validateRequired(['workout_id', 'exercise_id', 'set_order', 'weight_kg', 'reps'], req.body);
      validatePositive('weight_kg', weight_kg);

      if (reps < 1) {
        throw new Error('reps must be >= 1');
      }

      if (rpe && (rpe < 1 || rpe > 10)) {
        throw new Error('RPE must be between 1 and 10');
      }

      // Проверяем что workout принадлежит пользователю
      const { data: workout } = await supabaseAdmin
        .from('workouts')
        .select('id')
        .eq('id', workout_id)
        .eq('user_id', userId)
        .single();

      if (!workout) {
        throw new Error('Workout not found or access denied');
      }

      const { data, error } = await supabaseAdmin
        .from('sets')
        .insert({
          workout_id,
          exercise_id,
          set_order,
          weight_kg,
          reps,
          rpe: rpe || null,
          is_warmup: is_warmup || false,
          notes: notes || null
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        data
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Sets API error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}
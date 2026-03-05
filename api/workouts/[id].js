// file: api/workouts/[id].js
import { supabaseAdmin, validateRange } from '../_lib/supabase.js';
import { getUserId, corsHeaders, handleOptions } from '../_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return handleOptions(res);
  }

  try {
    const userId = getUserId(req);
    const { id } = req.query;

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('workouts')
        .select(`
          *,
          sets (
            id, exercise_id, set_order, weight_kg, reps, rpe, 
            is_warmup, is_failure, notes, created_at,
            exercises (id, name_ru, primary_muscle)
          )
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    if (req.method === 'PUT') {
      const { notes, mood, energy_level, end_time } = req.body;

      if (mood) validateRange('mood', mood, 1, 5);
      if (energy_level) validateRange('energy_level', energy_level, 1, 5);

      const { data, error } = await supabaseAdmin
        .from('workouts')
        .update({
          notes,
          mood,
          energy_level,
          end_time: end_time || new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    if (req.method === 'DELETE') {
      // Soft delete
      const { data, error } = await supabaseAdmin
        .from('workouts')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: userId
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: 'Workout deleted',
        data
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Workout detail API error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}
// file: api/analytics/exercise-progress.js
import { supabaseAdmin } from '../_lib/supabase.js';
import { getUserId, handleOptions } from '../_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return handleOptions(res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    const { exercise_id } = req.query;

    // Источник: SQL view - exercise_progress
    const { data, error } = await supabaseAdmin
        .from('exercise_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_id', exercise_id)
      .order('workout_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Exercise progress API error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}
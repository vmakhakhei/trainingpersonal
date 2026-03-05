// file: api/sets/[id].js
import { supabaseAdmin, validatePositive } from '../_lib/supabase.js';
import { getUserId, handleOptions } from '../_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return handleOptions(res);
  }

  try {
    const userId = getUserId(req);
    const { id } = req.query;

    if (req.method === 'PUT') {
      const { weight_kg, reps, rpe, notes } = req.body;

      if (weight_kg !== undefined) validatePositive('weight_kg', weight_kg);
      if (reps !== undefined && reps < 1) {
        throw new Error('reps must be >= 1');
      }

      const { data, error } = await supabaseAdmin
        .from('sets')
        .update({
          weight_kg,
          reps,
          rpe: rpe || null,
          notes: notes || null
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    if (req.method === 'DELETE') {
      const { data, error } = await supabaseAdmin
        .from('sets')
        .update({
          is_deleted: true,
          deleted_by: userId
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: 'Set deleted',
        data
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Set detail API error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}
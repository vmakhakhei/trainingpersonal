// file: api/instructions/[id].js
import { supabaseAdmin } from '../_lib/supabase.js';
import { getUserId, handleOptions } from '../_lib/auth.js';

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
        .from('instructions')
        .select('*, exercises(name_ru)')
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
      const { title, content, instruction_type } = req.body;

      const { data, error } = await supabaseAdmin
        .from('instructions')
        .update({
          title,
          content,
          instruction_type
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
      const { data, error } = await supabaseAdmin
        .from('instructions')
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
        message: 'Instruction deleted',
        data
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Instruction detail API error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}
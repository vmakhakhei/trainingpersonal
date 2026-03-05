// file: api/approaches/index.js
import { supabaseAdmin, validateRequired } from '../_lib/supabase.js';
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
      const { data, error } = await supabaseAdmin
        .from('approaches')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    if (req.method === 'POST') {
      const { name, description, approach_type, parameters } = req.body;

      validateRequired(['name'], req.body);

      const { data, error } = await supabaseAdmin
        .from('approaches')
        .insert({
          user_id: userId,
          name,
          description: description || null,
          approach_type: approach_type || 'periodization',
          parameters: parameters || {}
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
    console.error('Approaches API error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}
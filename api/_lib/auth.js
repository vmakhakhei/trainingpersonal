// file: api/_lib/auth.js
export function getUserId(req) {
    // Single-user mode: возвращаем константу из env
    const userId = process.env.VITE_SINGLE_USER_ID;
    
    if (!userId || userId === 'YOUR_SUPABASE_USER_ID') {
      throw new Error('VITE_SINGLE_USER_ID not configured');
    }
    
    return userId;
  }
  
  export function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }
  
  export function handleOptions(res) {
    return res.status(200).json({});
  }
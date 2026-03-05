// file: src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Отсутствуют Supabase переменные окружения. Проверьте .env файл.');
}

// Источник: architecture.backend - Supabase (Auth/Postgres/Storage)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-timezone': 'Europe/Warsaw' // источник: ux_guidelines.timezone
    }
  }
});

// Single user ID (источник: meta.scope - single-user app)
export const SINGLE_USER_ID = import.meta.env.VITE_SINGLE_USER_ID;

export const validateSingleUserId = () => {
  if (!SINGLE_USER_ID || SINGLE_USER_ID === 'YOUR_SUPABASE_USER_ID') {
    console.warn('⚠️ VITE_SINGLE_USER_ID не установлен. Установите его в .env файле.');
    return false;
  }
  return true;
};
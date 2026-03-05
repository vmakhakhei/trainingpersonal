// file: api/_lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

// Service role client для server-side операций
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Validation helpers
export function validateRequired(fields, data) {
  const missing = fields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function validatePositive(field, value) {
  if (value < 0) {
    throw new Error(`${field} must be >= 0`);
  }
}

export function validateRange(field, value, min, max) {
  if (value < min || value > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
}
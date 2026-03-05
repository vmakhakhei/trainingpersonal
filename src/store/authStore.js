// file: src/store/authStore.js
import { create } from 'zustand';
import { supabase, SINGLE_USER_ID, validateSingleUserId } from '../lib/supabase';

function formatAuthError(error) {
  const message = error?.message || 'Ошибка авторизации';
  const isInvalidCredentials =
    error?.code === 'invalid_credentials' ||
    /invalid login credentials/i.test(message);

  if (isInvalidCredentials) {
    return 'Неверный email или пароль. Если пароль точно верный, проверьте что пользователь есть в этом Supabase проекте и подтвержден по email.';
  }

  return message;
}

export const useAuthStore = create((set, get) => ({
  user: undefined,
  loading: false,
  error: null,
  session: null,

  initialize: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      set({ 
        user: session?.user ?? null,
        session: session,
        loading: false 
      });

      if (session?.user) {
        validateSingleUserId();
      }

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ 
          user: session?.user ?? null,
          session: session
        });
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ user: null, session: null, error: error.message, loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.replace(/\r?\n/g, '');

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword
      });
      
      if (error) throw error;
      
      set({ 
        user: data.user, 
        session: data.session,
        loading: false 
      });
      
      return { success: true, user: data.user };
    } catch (error) {
      const formattedError = formatAuthError(error);
      set({ error: formattedError, loading: false });
      return { success: false, error: formattedError };
    }
  },

  signUp: async (email, password, metadata = {}) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
      
      if (error) throw error;
      
      set({ loading: false });
      return { 
        success: true, 
        user: data.user,
        message: 'Проверьте email для подтверждения регистрации'
      };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { success: false, error: error.message };
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      set({ 
        user: null, 
        session: null,
        loading: false 
      });
      
      return { success: true };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { success: false, error: error.message };
    }
  },

  getUser: () => get().user,
  getSession: () => get().session
}));

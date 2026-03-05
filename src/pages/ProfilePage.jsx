// file: src/pages/ProfilePage.jsx
import { useCallback, useEffect, useState } from 'react';
import { User, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleSignOut() {
    if (confirm('Выйти из аккаунта?')) {
      await signOut();
      navigate('/login');
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-32 bg-dark-surface rounded-xl mb-4"></div>
          <div className="h-48 bg-dark-surface rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Профиль</h1>

      {/* User Info */}
      <div className="card mb-4">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="font-semibold">{profile?.full_name || 'Пользователь'}</div>
            <div className="text-sm text-dark-muted">{user?.email}</div>
          </div>
        </div>

        <div className="pt-4 border-t border-dark-border space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-dark-muted">Timezone</span>
            <span>{profile?.timezone || 'Europe/Warsaw'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-muted">Единицы</span>
            <span>{profile?.units_system === 'metric' ? 'Метрические' : 'Имперские'}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/settings')}
          className="w-full card hover:bg-dark-elevated transition-colors flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <Settings className="w-5 h-5 text-dark-muted" />
            <span>Настройки</span>
          </div>
          <span className="text-dark-muted">→</span>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full card hover:bg-dark-elevated transition-colors flex items-center space-x-3 text-error"
        >
          <LogOut className="w-5 h-5" />
          <span>Выйти</span>
        </button>
      </div>

      {/* App Info */}
      <div className="mt-8 text-center text-sm text-dark-muted">
        <p>GymTracker PWA v1.0.0</p>
        <p className="mt-1">Made with ❤️ for strength training</p>
      </div>
    </div>
  );
}

// file: src/pages/SettingsPage.jsx
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [settings, setSettings] = useState({
    full_name: '',
    timezone: 'Europe/Warsaw',
    units_system: 'metric'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          full_name: data.full_name || '',
          timezone: data.timezone || 'Europe/Warsaw',
          units_system: data.units_system || 'metric'
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveSettings() {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: settings.full_name,
          timezone: settings.timezone,
          units_system: settings.units_system
        });

      if (error) throw error;

      alert('Настройки сохранены');
      navigate('/profile');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-48 bg-dark-surface rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <div className="bg-dark-surface border-b border-dark-border p-4 safe-top">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-dark-elevated rounded">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Настройки</h1>
          <div className="w-9"></div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="p-4 space-y-4">
        <div className="card">
          <label className="block text-sm font-medium mb-2">Имя</label>
          <input
            type="text"
            value={settings.full_name}
            onChange={(e) => setSettings({...settings, full_name: e.target.value})}
            className="input-field w-full"
            placeholder="Ваше имя"
          />
        </div>

        <div className="card">
          <label className="block text-sm font-medium mb-2">Timezone</label>
          <select
            value={settings.timezone}
            onChange={(e) => setSettings({...settings, timezone: e.target.value})}
            className="input-field w-full"
          >
            <option value="Europe/Warsaw">Europe/Warsaw</option>
            <option value="Europe/Moscow">Europe/Moscow</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </div>

        <div className="card">
          <label className="block text-sm font-medium mb-2">Единицы измерения</label>
          <select
            value={settings.units_system}
            onChange={(e) => setSettings({...settings, units_system: e.target.value})}
            className="input-field w-full"
          >
            <option value="metric">Метрические (кг, см)</option>
            <option value="imperial">Имперские (lb, in)</option>
          </select>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          <Save className="w-5 h-5" />
          <span>{saving ? 'Сохранение...' : 'Сохранить'}</span>
        </button>
      </div>
    </div>
  );
}

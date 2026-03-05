// file: src/pages/ApproachesPage.jsx
import { useEffect, useState } from 'react';
import { Plus, BookOpen, Trash2 } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import { APPROACH_TYPES } from '../lib/constants';

export default function ApproachesPage() {
  const [approaches, setApproaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    approach_type: 'periodization'
  });

  useEffect(() => {
    loadApproaches();
  }, []);

  async function loadApproaches() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('approaches')
        .select('*')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApproaches(data || []);
    } catch (error) {
      console.error('Error loading approaches:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveApproach() {
    if (!formData.name.trim()) {
      alert('Введите название');
      return;
    }

    try {
      const { error } = await supabase
        .from('approaches')
        .insert({
          user_id: SINGLE_USER_ID,
          name: formData.name,
          description: formData.description,
          approach_type: formData.approach_type
        });

      if (error) throw error;

      setShowForm(false);
      setFormData({ name: '', description: '', approach_type: 'periodization' });
      loadApproaches();
    } catch (error) {
      console.error('Error saving approach:', error);
      alert('Ошибка сохранения');
    }
  }

  async function deleteApproach(id) {
    if (!confirm('Удалить методику?')) return;

    try {
      const { error } = await supabase
        .from('approaches')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: SINGLE_USER_ID
        })
        .eq('id', id);

      if (error) throw error;
      loadApproaches();
    } catch (error) {
      console.error('Error deleting approach:', error);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-dark-surface rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Методики тренировок</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {approaches.length === 0 && !showForm ? (
        <div className="card text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted mb-4">Нет методик</p>
          <button onClick={() => setShowForm(true)} className="btn-primary inline-block">
            Создать методику
          </button>
        </div>
      ) : (
        <>
          {showForm && (
            <div className="card mb-4">
              <h3 className="font-semibold mb-4">Новая методика</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Название</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="input-field w-full"
                    placeholder="5/3/1, PPL, Upper/Lower..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Тип</label>
                  <select
                    value={formData.approach_type}
                    onChange={(e) => setFormData({...formData, approach_type: e.target.value})}
                    className="input-field w-full"
                  >
                    {APPROACH_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Описание</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="input-field w-full"
                    rows={3}
                    placeholder="Описание методики..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button onClick={saveApproach} className="btn-primary flex-1">
                    Сохранить
                  </button>
                  <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {approaches.map(approach => (
              <div key={approach.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{approach.name}</h3>
                    <p className="text-sm text-dark-muted mt-1">
                      {APPROACH_TYPES.find(t => t.value === approach.approach_type)?.label}
                    </p>
                    {approach.description && (
                      <p className="text-sm text-dark-muted mt-2">{approach.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteApproach(approach.id)}
                    className="p-2 hover:bg-dark-elevated rounded"
                  >
                    <Trash2 className="w-4 h-4 text-error" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

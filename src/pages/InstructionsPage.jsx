// file: src/pages/InstructionsPage.jsx
import React, { useEffect, useState } from 'react';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';
import { INSTRUCTION_TYPES } from '../lib/constants';

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    exercise_id: '',
    title: '',
    content: '',
    instruction_type: 'technique'
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [instRes, exRes] = await Promise.all([
        supabase
          .from('instructions')
          .select('*, exercises(name_ru)')
          .eq('user_id', SINGLE_USER_ID)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('exercises')
          .select('id, name_ru')
          .eq('is_deleted', false)
          .order('name_ru')
      ]);

      if (instRes.error) throw instRes.error;
      if (exRes.error) throw exRes.error;

      setInstructions(instRes.data || []);
      setExercises(exRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveInstruction() {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Заполните название и содержание');
      return;
    }

    try {
      const { error } = await supabase
        .from('instructions')
        .insert({
          user_id: SINGLE_USER_ID,
          exercise_id: formData.exercise_id || null,
          title: formData.title,
          content: formData.content,
          instruction_type: formData.instruction_type
        });

      if (error) throw error;

      setShowForm(false);
      setFormData({ exercise_id: '', title: '', content: '', instruction_type: 'technique' });
      loadData();
    } catch (error) {
      console.error('Error saving instruction:', error);
      alert('Ошибка сохранения');
    }
  }

  async function deleteInstruction(id) {
    if (!confirm('Удалить инструкцию?')) return;

    try {
      const { error } = await supabase
        .from('instructions')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: SINGLE_USER_ID
        })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting instruction:', error);
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
        <h1 className="text-2xl font-bold">Инструкции</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {instructions.length === 0 && !showForm ? (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted mb-4">Нет инструкций</p>
          <button onClick={() => setShowForm(true)} className="btn-primary inline-block">
            Создать инструкцию
          </button>
        </div>
      ) : (
        <>
          {showForm && (
            <div className="card mb-4">
              <h3 className="font-semibold mb-4">Новая инструкция</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Упражнение (опционально)</label>
                  <select
                    value={formData.exercise_id}
                    onChange={(e) => setFormData({...formData, exercise_id: e.target.value})}
                    className="input-field w-full"
                  >
                    <option value="">Общая инструкция</option>
                    {exercises.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name_ru}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Тип</label>
                  <select
                    value={formData.instruction_type}
                    onChange={(e) => setFormData({...formData, instruction_type: e.target.value})}
                    className="input-field w-full"
                  >
                    {INSTRUCTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Название</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="input-field w-full"
                    placeholder="Правильная техника приседаний..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Содержание</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    className="input-field w-full"
                    rows={5}
                    placeholder="Подробное описание..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button onClick={saveInstruction} className="btn-primary flex-1">
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
            {instructions.map(inst => (
              <div key={inst.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold">{inst.title}</h3>
                      <span className="px-2 py-0.5 bg-primary-600/20 text-primary-500 text-xs rounded">
                        {INSTRUCTION_TYPES.find(t => t.value === inst.instruction_type)?.label}
                      </span>
                    </div>
                    {inst.exercises && (
                      <p className="text-xs text-dark-muted mb-2">{inst.exercises.name_ru}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteInstruction(inst.id)}
                    className="p-2 hover:bg-dark-elevated rounded"
                  >
                    <Trash2 className="w-4 h-4 text-error" />
                  </button>
                </div>
                <p className="text-sm text-dark-muted whitespace-pre-wrap">{inst.content}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
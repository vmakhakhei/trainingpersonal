// file: src/pages/LogWorkoutPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, X, Dumbbell } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';

export default function LogWorkoutPage() {
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [sets, setSets] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Источник: ux_guidelines - минимизация кликов (≤3 для добавления подхода)
  const [quickSet, setQuickSet] = useState({
    weight_kg: '',
    reps: '',
    rpe: ''
  });

  useEffect(() => {
    loadExercises();
    createWorkout();
  }, []);

  async function loadExercises() {
    // Источник: core_features.exercise_library
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('is_deleted', false)
      .order('name_ru');

    if (!error && data) {
      setExercises(data);
    }
  }

  async function createWorkout() {
    try {
      setLoading(true);
      // Источник: core_features.log_workout
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: SINGLE_USER_ID,
          workout_date: new Date().toISOString().split('T')[0],
          start_time: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setWorkout(data);
    } catch (error) {
      console.error('Error creating workout:', error);
      alert('Ошибка создания тренировки');
    } finally {
      setLoading(false);
    }
  }

  async function addSet() {
    if (!selectedExercise || !quickSet.weight_kg || !quickSet.reps) {
      alert('Заполните вес и повторения');
      return;
    }

    try {
      // Источник: CONSTRAINTS - reps>=1, weight>=0
      const weight = parseFloat(quickSet.weight_kg);
      const reps = parseInt(quickSet.reps);
      const rpe = quickSet.rpe ? parseFloat(quickSet.rpe) : null;

      if (weight < 0 || reps < 1) {
        alert('Вес ≥0, повторения ≥1');
        return;
      }

      const nextOrder = sets.filter(s => s.exercise_id === selectedExercise.id).length + 1;

      const { data, error } = await supabase
        .from('sets')
        .insert({
          workout_id: workout.id,
          exercise_id: selectedExercise.id,
          set_order: nextOrder,
          weight_kg: weight,
          reps: reps,
          rpe: rpe
        })
        .select('*, exercises(name_ru)')
        .single();

      if (error) throw error;

      setSets([...sets, data]);
      setQuickSet({ weight_kg: quickSet.weight_kg, reps: '', rpe: '' });
    } catch (error) {
      console.error('Error adding set:', error);
      alert('Ошибка добавления подхода');
    }
  }

  async function finishWorkout() {
    try {
      await supabase
        .from('workouts')
        .update({ end_time: new Date().toISOString() })
        .eq('id', workout.id);

      navigate(`/workouts/${workout.id}`);
    } catch (error) {
      console.error('Error finishing workout:', error);
    }
  }

  if (loading || !workout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dark-muted">Создание тренировки...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <div className="bg-dark-surface border-b border-dark-border p-4 safe-top">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Новая тренировка</h1>
          <button
            onClick={finishWorkout}
            className="btn-primary flex items-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>Завершить</span>
          </button>
        </div>
      </div>

      {/* Exercise Selection */}
      {!selectedExercise ? (
        <div className="p-4">
          <button
            onClick={() => setShowExercisePicker(true)}
            className="w-full card-elevated py-8 text-center"
          >
            <Plus className="w-12 h-12 mx-auto text-primary-500 mb-3" />
            <p className="font-medium">Выберите упражнение</p>
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Selected Exercise */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Dumbbell className="w-6 h-6 text-primary-500" />
                <div>
                  <div className="font-semibold">{selectedExercise.name_ru}</div>
                  <div className="text-sm text-dark-muted">{selectedExercise.primary_muscle}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedExercise(null)}
                className="p-2 hover:bg-dark-elevated rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Set Input - Источник: ux_guidelines - ≤3 клика */}
          <div className="card">
            <div className="text-sm font-medium mb-3">Быстрое добавление подхода</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-dark-muted">Вес (кг)</label>
                <input
                  type="number"
                  value={quickSet.weight_kg}
                  onChange={(e) => setQuickSet({...quickSet, weight_kg: e.target.value})}
                  className="input-field w-full mt-1"
                  placeholder="100"
                  step="0.5"
                  min="0"
                />
              </div>
              <div>
                <label className="text-xs text-dark-muted">Повторения</label>
                <input
                  type="number"
                  value={quickSet.reps}
                  onChange={(e) => setQuickSet({...quickSet, reps: e.target.value})}
                  className="input-field w-full mt-1"
                  placeholder="10"
                  min="1"
                />
              </div>
              <div>
                <label className="text-xs text-dark-muted">RPE</label>
                <input
                  type="number"
                  value={quickSet.rpe}
                  onChange={(e) => setQuickSet({...quickSet, rpe: e.target.value})}
                  className="input-field w-full mt-1"
                  placeholder="8"
                  min="1"
                  max="10"
                  step="0.5"
                />
              </div>
            </div>
            <button onClick={addSet} className="btn-primary w-full">
              <Plus className="w-5 h-5 inline mr-2" />
              Добавить подход
            </button>
          </div>

          {/* Sets List */}
          <div className="space-y-2">
            {sets.filter(s => s.exercise_id === selectedExercise.id).map((set, idx) => (
              <div key={set.id} className="card flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-dark-muted font-mono">#{idx + 1}</div>
                  <div>
                    <div className="font-semibold">{set.weight_kg} кг × {set.reps}</div>
                    {set.rpe && <div className="text-sm text-dark-muted">RPE: {set.rpe}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-dark-surface w-full sm:max-w-lg sm:rounded-xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h2 className="font-semibold">Выбрать упражнение</h2>
              <button onClick={() => setShowExercisePicker(false)} className="p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
              {exercises.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => {
                    setSelectedExercise(ex);
                    setShowExercisePicker(false);
                  }}
                  className="w-full card hover:bg-dark-elevated transition-colors text-left"
                >
                  <div className="font-medium">{ex.name_ru}</div>
                  <div className="text-sm text-dark-muted">{ex.primary_muscle}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
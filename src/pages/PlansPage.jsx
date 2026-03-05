// file: src/pages/PlansPage.jsx
import React, { useEffect, useState } from 'react';
import { Plus, Calendar, Dumbbell } from 'lucide-react';
import { supabase, SINGLE_USER_ID } from '../lib/supabase';

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      // Источник: core_features.workout_plan
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*, plan_exercises(count)')
        .eq('user_id', SINGLE_USER_ID)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-dark-surface rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Планы тренировок</h1>
        <button className="btn-primary">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="w-16 h-16 mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted mb-4">Нет планов</p>
          <button className="btn-primary inline-block">
            Создать план
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-dark-muted mt-1">{plan.description}</p>
                  )}
                </div>
                {plan.is_active && (
                  <span className="px-2 py-1 bg-success/20 text-success text-xs rounded">
                    Активный
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-dark-muted" />
                  <span>{plan.days_per_week} дней/неделя</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Dumbbell className="w-4 h-4 text-dark-muted" />
                  <span>{plan.plan_exercises?.[0]?.count || 0} упражнений</span>
                </div>
              </div>

              {plan.goal && (
                <div className="mt-3 pt-3 border-t border-dark-border">
                  <span className="text-xs text-dark-muted">Цель:</span>{' '}
                  <span className="text-sm">{plan.goal}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
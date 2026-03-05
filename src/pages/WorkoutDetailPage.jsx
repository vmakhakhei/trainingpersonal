// file: src/pages/WorkoutDetailPage.jsx
import React from 'react';
import { Link, useParams } from 'react-router-dom';

export default function WorkoutDetailPage() {
  const { id } = useParams();

  return (
    <div className="space-y-4">
      <div className="card-elevated">
        <h1 className="text-xl font-semibold text-dark-text">Детали тренировки</h1>
        <p className="text-sm text-dark-muted mt-2">ID тренировки: {id}</p>
        <p className="text-sm text-dark-muted mt-1">
          Страница-заглушка. Можно расширить историей подходов, заметками и метриками.
        </p>
      </div>

      <Link to="/workouts" className="btn-secondary inline-flex items-center">
        Назад к тренировкам
      </Link>
    </div>
  );
}

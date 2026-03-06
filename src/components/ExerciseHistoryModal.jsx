import { X } from 'lucide-react';

export default function ExerciseHistoryModal({
    isOpen,
    onClose,
    exerciseName = '',
    history = {},
    onAddSet,
    onAddAllFromDate
}) {
    if (!isOpen) return null;

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const dates = Object.keys(history).sort((a, b) => new Date(b) - new Date(a));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-dark-surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-border">
                    <div>
                        <h2 className="text-lg font-bold">История упражнения</h2>
                        {exerciseName && (
                            <p className="text-sm text-dark-muted mt-1">{exerciseName}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-dark-border rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {dates.length === 0 ? (
                        <div className="text-center py-8 text-dark-muted">
                            Нет данных о прошлых подходах
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {dates.map((date) => {
                                const sets = history[date];
                                const totalVolume = sets.reduce(
                                    (sum, set) => sum + set.weight_kg * set.reps,
                                    0
                                );
                                const maxWeight = Math.max(...sets.map((s) => s.weight_kg));

                                return (
                                    <div key={date} className="border border-dark-border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="font-medium">{formatDate(date)}</h3>
                                                <div className="text-xs text-dark-muted mt-1">
                                                    {sets.length} подходов • {totalVolume.toFixed(0)} кг объёма • Макс {maxWeight} кг
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onAddAllFromDate(date)}
                                                className="btn-primary text-sm px-3 py-2"
                                            >
                                                Добавить все
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {sets.map((set) => (
                                                <div
                                                    key={set.id}
                                                    className="flex items-center justify-between p-3 bg-dark-bg rounded-lg"
                                                >
                                                    <div>
                                                        <div className="font-medium">
                                                            {set.weight_kg} кг × {set.reps}
                                                            {set.rpe && (
                                                                <span className="text-dark-muted ml-2">RPE {set.rpe}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-dark-muted">
                                                            Подход {set.set_order} • {set.weight_kg * set.reps} кг
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => onAddSet(set)}
                                                        className="btn-secondary text-sm px-3 py-2"
                                                    >
                                                        Добавить
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-dark-border">
                    <button
                        onClick={onClose}
                        className="w-full btn-secondary py-3"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}
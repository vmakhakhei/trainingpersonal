export default function SuggestionPill({ suggestion, onApply, disabled = false }) {
  if (!suggestion?.payload) {
    return null;
  }

  const confidence = Number.isFinite(Number(suggestion.confidence))
    ? Math.round(Number(suggestion.confidence) * 100)
    : null;

  const weight = suggestion.payload.weight_kg;
  const reps = suggestion.payload.reps;

  const tooltipLines = [
    'Почему:',
    suggestion.explain || 'основано на последних подходах'
  ];

  if (confidence !== null) {
    tooltipLines.push(`Уверенность: ${confidence}%`);
  }

  return (
    <button
      type="button"
      onClick={() => onApply?.(suggestion.payload)}
      disabled={disabled}
      title={tooltipLines.join('\n')}
      className="w-full rounded-lg border border-primary-500/40 bg-primary-500/10 px-3 py-2 text-left transition-colors hover:bg-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Предложение: {weight} кг × {reps}</span>
        {confidence !== null && (
          <span className="text-xs text-dark-muted">(confidence {confidence}%)</span>
        )}
      </div>
    </button>
  );
}

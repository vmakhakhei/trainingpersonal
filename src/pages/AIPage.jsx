import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

export default function AIPage() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  async function sendPrompt() {
    if (!prompt.trim()) return;

    try {
      setLoading(true);
      setResponse(null);

      // Источник: architecture.ai_proxy - DeepSeek через Vercel proxy
      const aiProxyUrl = import.meta.env.VITE_AI_PROXY_URL || '/api/ai/proxy';
      
      const res = await fetch(aiProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'AI request failed');
      }

      setResponse(data.data);
    } catch (error) {
      console.error('AI error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">AI Ассистент</h1>
          <p className="text-dark-muted">
            Задайте вопрос о тренировках, питании или технике упражнений
          </p>
        </div>

        {/* Input */}
        <div className="card mb-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="input-field w-full"
            rows={4}
            placeholder="Например: Как правильно делать приседания?"
            disabled={loading}
          />
          <button
            onClick={sendPrompt}
            disabled={loading || !prompt.trim()}
            className="btn-primary w-full mt-3 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Обработка...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Отправить</span>
              </>
            )}
          </button>
        </div>

        {/* Response - Источник: AI output format requirement */}
        {response && (
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold">Ответ AI</h3>
              {response.cached && (
                <span className="text-xs px-2 py-1 bg-success/20 text-success rounded">
                  Из кеша
                </span>
              )}
            </div>

            <div className="prose prose-invert max-w-none mb-4">
              <p className="whitespace-pre-wrap">{response.answer}</p>
            </div>

            {/* Sources - Источник: rag_policy.citation_required */}
            {response.sources && response.sources.length > 0 && (
              <div className="pt-4 border-t border-dark-border">
                <div className="text-sm font-medium mb-2">Источники:</div>
                <div className="space-y-2">
                  {response.sources.map((source, idx) => (
                    <div key={idx} className="text-sm text-dark-muted">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-500 hover:underline"
                        >
                          [{idx + 1}] {source.excerpt || source.url}
                        </a>
                      ) : (
                        <span>[{idx + 1}] {source.excerpt}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence */}
            {response.confidence !== null && response.confidence !== undefined && (
              <div className="mt-3 pt-3 border-t border-dark-border text-sm">
                <span className="text-dark-muted">Уверенность:</span>{' '}
                <span className="font-semibold">
                  {Math.round(response.confidence * 100)}%
                </span>
              </div>
            )}

            {/* Low verification warning */}
            {response.note && response.verification === 'low' && (
              <div className="mt-3 p-3 bg-warning/10 border border-warning rounded text-sm">
                <strong>Внимание:</strong> {response.note}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

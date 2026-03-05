// file: api/ai/proxy.js
import crypto from 'crypto';
import { executeToolRequest } from '../tools.js';
import { supabaseAdmin } from '../_lib/supabase.js';
import { getUserId, handleOptions } from '../_lib/auth.js';
import {
  CACHE_TTL_HOURS,
  DEEPSEEK_API_KEY,
  DEEPSEEK_API_URL,
  RATE_LIMIT_PER_HOUR
} from '../_lib/aiConfig.js';

const DEEPSEEK_TIMEOUT_MS = 8000;

class ProxyError extends Error {
  constructor(message, code = 'PROXY_ERROR', statusCode = 500) {
    super(message);
    this.name = 'ProxyError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function safeJsonParse(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function generateCacheKey(prompt, context = {}) {
  const dataToHash = JSON.stringify({ prompt, context });
  return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

function mapProxyError(error) {
  if (error instanceof ProxyError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    };
  }

  if (typeof error?.statusCode === 'number' && typeof error?.code === 'string') {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message || 'Request failed'
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: error?.message || 'Internal server error'
  };
}

async function checkRateLimit(userId) {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const { count, error } = await supabaseAdmin
    .from('ai_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo);

  if (error) {
    throw error;
  }

  if (count >= RATE_LIMIT_PER_HOUR) {
    throw new ProxyError(
      `Rate limit exceeded. Max ${RATE_LIMIT_PER_HOUR} requests per hour.`,
      'RATE_LIMIT_EXCEEDED',
      429
    );
  }
}

async function getCachedResponse(cacheKey) {
  const { data, error } = await supabaseAdmin
    .from('ai_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  await supabaseAdmin
    .from('ai_cache')
    .update({ hit_count: data.hit_count + 1 })
    .eq('id', data.id);

  return data.response_data;
}

async function cacheResponse(cacheKey, promptHash, responseData, sources, confidence) {
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 3600000).toISOString();

  await supabaseAdmin.from('ai_cache').insert({
    cache_key: cacheKey,
    prompt_hash: promptHash,
    response_data: responseData,
    sources: sources || null,
    confidence: confidence ?? null,
    expires_at: expiresAt
  });
}

async function logRequest(userId, endpoint, promptText, responseText, statusCode, error, latencyMs) {
  await supabaseAdmin.from('ai_requests').insert({
    user_id: userId || null,
    endpoint,
    prompt_text: promptText?.substring(0, 500),
    response_text: responseText?.substring(0, 1000),
    status_code: statusCode,
    error_message: error || null,
    latency_ms: latencyMs
  });
}

function parseToolCall(message, parsedMessageContent) {
  if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
    const firstCall = message.tool_calls[0];
    const name = firstCall?.function?.name || firstCall?.name;
    const rawArguments = firstCall?.function?.arguments ?? firstCall?.arguments ?? {};

    if (!name || typeof name !== 'string') {
      throw new ProxyError('tool_call name is missing', 'INVALID_TOOL_CALL', 400);
    }

    let input = rawArguments;
    if (typeof rawArguments === 'string') {
      input = safeJsonParse(rawArguments);
      if (!input || typeof input !== 'object') {
        throw new ProxyError('tool_call arguments must be valid JSON', 'INVALID_TOOL_CALL', 400);
      }
    }

    return {
      name,
      input: input || {}
    };
  }

  if (parsedMessageContent?.tool_call?.name) {
    return {
      name: parsedMessageContent.tool_call.name,
      input:
        parsedMessageContent.tool_call.arguments ||
        parsedMessageContent.tool_call.input ||
        {}
    };
  }

  return null;
}

async function fetchDeepSeek(prompt, context = {}) {
  if (!DEEPSEEK_API_KEY) {
    throw new ProxyError('DeepSeek API key not configured', 'DEEPSEEK_KEY_MISSING', 500);
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'Ты — AI фитнес-ассистент. Отвечай на русском языке. Используй structured output. При необходимости верни tool_call с name и arguments.'
          },
          {
            role: 'user',
            content: `${prompt}\n\nКонтекст: ${JSON.stringify(context)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new ProxyError(
        `DeepSeek API error: ${response.status} ${response.statusText}`,
        'DEEPSEEK_HTTP_ERROR',
        502
      );
    }

    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ProxyError(
        `DeepSeek request timed out after ${DEEPSEEK_TIMEOUT_MS}ms`,
        'LLM_TIMEOUT',
        504
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function normalizeNonToolResponse(aiResponseText) {
  const parsed = safeJsonParse(aiResponseText);

  if (parsed && typeof parsed === 'object') {
    return {
      answer: parsed.answer || aiResponseText,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      confidence:
        typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
          ? parsed.confidence
          : null,
      note: parsed.note,
      verification: parsed.verification
    };
  }

  return {
    answer: aiResponseText,
    sources: [],
    confidence: null,
    note: 'Не подтверждено',
    verification: 'low'
  };
}

export function createAiProxyHandler(overrides = {}) {
  const deps = {
    getUserId,
    checkRateLimit,
    getCachedResponse,
    cacheResponse,
    logRequest,
    fetchDeepSeek,
    executeToolRequest,
    now: () => Date.now(),
    ...overrides
  };

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return handleOptions(res);
    }

    const startTime = deps.now();
    let userId = null;

    try {
      if (req.method !== 'POST') {
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        });
      }

      userId = deps.getUserId(req);
      await deps.checkRateLimit(userId);

      const { prompt, context = {}, bypass_cache = false } = req.body || {};

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        throw new ProxyError('Prompt is required', 'INVALID_ARGUMENTS', 400);
      }

      const cacheKey = generateCacheKey(prompt, context);
      const promptHash = crypto.createHash('md5').update(prompt).digest('hex');

      if (!bypass_cache) {
        const cached = await deps.getCachedResponse(cacheKey);
        if (cached) {
          const latency = deps.now() - startTime;
          await deps
            .logRequest(
              userId,
              '/api/ai/proxy',
              prompt,
              JSON.stringify(cached),
              200,
              null,
              latency
            )
            .catch(() => {});

          if (cached.tool_call && Object.prototype.hasOwnProperty.call(cached, 'tool_result')) {
            return res.status(200).json({ ...cached, cached: true });
          }

          return res.status(200).json({
            success: true,
            data: cached,
            cached: true
          });
        }
      }

      const deepseekData = await deps.fetchDeepSeek(prompt, context);
      const message = deepseekData?.choices?.[0]?.message || {};
      const aiResponseText = typeof message.content === 'string' ? message.content : '';
      const parsedMessageContent = safeJsonParse(aiResponseText);
      const toolCall = parseToolCall(message, parsedMessageContent);

      if (toolCall) {
        const toolExecution = await deps.executeToolRequest({
          tool: toolCall.name,
          arguments: toolCall.input,
          userId
        });

        const answer =
          typeof parsedMessageContent?.answer === 'string'
            ? parsedMessageContent.answer
            : aiResponseText.trim() || `Инструмент ${toolExecution.tool_call.name} выполнен.`;

        const sources = Array.isArray(parsedMessageContent?.sources)
          ? parsedMessageContent.sources
          : [];

        const parsedConfidence = Number(parsedMessageContent?.confidence);
        const confidence = Number.isFinite(parsedConfidence) ? parsedConfidence : 0;

        const toolResponse = {
          success: true,
          tool_call: toolExecution.tool_call,
          tool_result: toolExecution.tool_result,
          answer,
          sources,
          cached: false,
          confidence
        };

        await deps.cacheResponse(cacheKey, promptHash, toolResponse, sources, confidence);

        const latency = deps.now() - startTime;
        await deps
          .logRequest(
            userId,
            '/api/ai/proxy',
            prompt,
            JSON.stringify(toolResponse),
            200,
            null,
            latency
          )
          .catch(() => {});

        return res.status(200).json(toolResponse);
      }

      const responseData = normalizeNonToolResponse(aiResponseText);

      await deps.cacheResponse(
        cacheKey,
        promptHash,
        responseData,
        responseData.sources,
        responseData.confidence
      );

      const latency = deps.now() - startTime;
      await deps
        .logRequest(
          userId,
          '/api/ai/proxy',
          prompt,
          JSON.stringify(responseData),
          200,
          null,
          latency
        )
        .catch(() => {});

      return res.status(200).json({
        success: true,
        data: responseData,
        cached: false
      });
    } catch (error) {
      const mappedError = mapProxyError(error);
      const latency = deps.now() - startTime;

      await deps
        .logRequest(
          userId,
          '/api/ai/proxy',
          req.body?.prompt,
          null,
          mappedError.statusCode,
          mappedError.message,
          latency
        )
        .catch(() => {});

      return res.status(mappedError.statusCode).json({
        success: false,
        error: mappedError.message,
        code: mappedError.code
      });
    }
  };
}

const handler = createAiProxyHandler();

export default handler;

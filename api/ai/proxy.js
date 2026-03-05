// file: api/ai/proxy.js
import crypto from 'crypto';
import { supabaseAdmin } from '../_lib/supabase.js';
import { getUserId, handleOptions } from '../_lib/auth.js';

// Источник: rag_policy - ttl_hours: 72, citation_required: true
const CACHE_TTL_HOURS = 72;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Rate limit: {"note":"Не подтверждено","verification":"low"} - используем базовое ограничение
const RATE_LIMIT_PER_HOUR = 60;

function generateCacheKey(prompt, context = {}) {
  const dataToHash = JSON.stringify({ prompt, context });
  return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

async function checkRateLimit(userId) {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  
  const { count, error } = await supabaseAdmin
    .from('ai_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo);

  if (error) throw error;

  if (count >= RATE_LIMIT_PER_HOUR) {
    throw new Error(`Rate limit exceeded. Max ${RATE_LIMIT_PER_HOUR} requests per hour.`);
  }
}

async function getCachedResponse(cacheKey) {
  const { data, error } = await supabaseAdmin
    .from('ai_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;

  // Increment hit count
  await supabaseAdmin
    .from('ai_cache')
    .update({ hit_count: data.hit_count + 1 })
    .eq('id', data.id);

  return data.response_data;
}

async function cacheResponse(cacheKey, promptHash, responseData, sources, confidence) {
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 3600000).toISOString();

  await supabaseAdmin
    .from('ai_cache')
    .insert({
      cache_key: cacheKey,
      prompt_hash: promptHash,
      response_data: responseData,
      sources: sources || null,
      confidence: confidence || null,
      expires_at: expiresAt
    });
}

async function logRequest(userId, endpoint, promptText, responseText, statusCode, error, latencyMs) {
  await supabaseAdmin
    .from('ai_requests')
    .insert({
      user_id: userId,
      endpoint,
      prompt_text: promptText?.substring(0, 500),
      response_text: responseText?.substring(0, 1000),
      status_code: statusCode,
      error_message: error || null,
      latency_ms: latencyMs
    });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return handleOptions(res);
  }

  const startTime = Date.now();

  try {
    const userId = getUserId(req);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check rate limit
    await checkRateLimit(userId);

    const { prompt, context = {}, bypass_cache = false } = req.body;

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const cacheKey = generateCacheKey(prompt, context);
    const promptHash = crypto.createHash('md5').update(prompt).digest('hex');

    // Check cache if not bypassed
    if (!bypass_cache) {
      const cached = await getCachedResponse(cacheKey);
      if (cached) {
        const latency = Date.now() - startTime;
        await logRequest(userId, '/api/ai/proxy', prompt, JSON.stringify(cached), 200, null, latency);
        
        return res.status(200).json({
          success: true,
          data: cached,
          cached: true
        });
      }
    }

    // Call DeepSeek API
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key not configured');
    }

    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Ты — AI фитнес-ассистент. Отвечай на русском языке. Всегда возвращай ответ в формате JSON с полями: answer (текст ответа), sources (массив объектов с id, excerpt, url), confidence (число от 0 до 1).'
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

    if (!deepseekResponse.ok) {
      throw new Error(`DeepSeek API error: ${deepseekResponse.statusText}`);
    }

    const deepseekData = await deepseekResponse.json();
    const aiResponseText = deepseekData.choices[0]?.message?.content || '';

    // Parse AI response
    let responseData;
    try {
      responseData = JSON.parse(aiResponseText);
    } catch (e) {
      // Если AI не вернул JSON, формируем структуру
      responseData = {
        answer: aiResponseText,
        sources: [],
        confidence: null,
        note: "Не подтверждено",
        verification: "low"
      };
    }

    // Validate response format (источник: AI output format requirement)
    if (!responseData.answer) {
      responseData = {
        answer: aiResponseText,
        sources: responseData.sources || [],
        confidence: responseData.confidence || null
      };
    }

    // Cache response
    await cacheResponse(
      cacheKey,
      promptHash,
      responseData,
      responseData.sources,
      responseData.confidence
    );

    const latency = Date.now() - startTime;
    await logRequest(userId, '/api/ai/proxy', prompt, JSON.stringify(responseData), 200, null, latency);

    return res.status(200).json({
      success: true,
      data: responseData,
      cached: false
    });

  } catch (error) {
    console.error('AI proxy error:', error);
    
    const latency = Date.now() - startTime;
    await logRequest(
      getUserId(req),
      '/api/ai/proxy',
      req.body?.prompt,
      null,
      500,
      error.message,
      latency
    ).catch(() => {});

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
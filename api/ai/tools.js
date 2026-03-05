import { supabaseAdmin } from '../_lib/supabase.js';
import { getUserId, handleOptions } from '../_lib/auth.js';
import { RATE_LIMIT_PER_HOUR } from '../_lib/aiConfig.js';
import { executeTool } from '../_lib/aiToolsExecutor.js';
import { ToolValidationError, validateToolRequest } from '../_lib/aiToolsValidation.js';

class ToolApiError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'ToolApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function truncate(value, maxLength) {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
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
    throw new ToolApiError(
      `Rate limit exceeded. Max ${RATE_LIMIT_PER_HOUR} requests per hour.`,
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}

async function logToolRequest({
  userId,
  requestPayload,
  responsePayload,
  statusCode,
  errorMessage,
  latencyMs
}) {
  await supabaseAdmin.from('ai_requests').insert({
    user_id: userId || null,
    endpoint: '/api/ai/tools',
    prompt_text: truncate(requestPayload, 500),
    response_text: truncate(responsePayload, 1000),
    status_code: statusCode,
    error_message: errorMessage || null,
    latency_ms: latencyMs
  });
}

function mapError(error) {
  if (error instanceof ToolValidationError) {
    return {
      statusCode: error.statusCode || 400,
      code: error.code || 'VALIDATION_ERROR',
      message: error.message
    };
  }

  if (error instanceof ToolApiError) {
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

export function createAiToolsHandler(overrides = {}) {
  const deps = {
    getUserId,
    checkRateLimit,
    validateToolRequest,
    executeTool,
    logToolRequest,
    now: () => Date.now(),
    isoNow: () => new Date().toISOString(),
    ...overrides
  };

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return handleOptions(res);
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    const startedAt = deps.now();
    let userId = null;
    let requestPayload = null;

    try {
      userId = deps.getUserId(req);
      await deps.checkRateLimit(userId);

      const validated = deps.validateToolRequest(req.body || {});
      requestPayload = JSON.stringify(validated);

      const result = await deps.executeTool({
        tool: validated.tool,
        args: validated.arguments,
        userId
      });

      const latencyMs = deps.now() - startedAt;
      const responseData = {
        tool: validated.tool,
        arguments: validated.arguments,
        result,
        meta: {
          executed_at: deps.isoNow(),
          latency_ms: latencyMs,
          row_count: Array.isArray(result) ? result.length : null
        }
      };

      await deps
        .logToolRequest({
          userId,
          requestPayload,
          responsePayload: JSON.stringify(responseData),
          statusCode: 200,
          errorMessage: null,
          latencyMs
        })
        .catch(() => {});

      return res.status(200).json({
        success: true,
        data: responseData
      });
    } catch (error) {
      const latencyMs = deps.now() - startedAt;
      const mappedError = mapError(error);

      await deps
        .logToolRequest({
          userId,
          requestPayload,
          responsePayload: null,
          statusCode: mappedError.statusCode,
          errorMessage: mappedError.message,
          latencyMs
        })
        .catch(() => {});

      return res.status(mappedError.statusCode).json({
        success: false,
        error: mappedError.message,
        code: mappedError.code
      });
    }
  };
}

const handler = createAiToolsHandler();

export default handler;

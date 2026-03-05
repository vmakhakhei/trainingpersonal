import { RATE_LIMIT_PER_HOUR } from './_lib/aiConfig.js';
import { getUserId, handleOptions } from './_lib/auth.js';
import { supabaseAdmin } from './_lib/supabase.js';
import { executeTool, ToolExecutionError } from './_lib/toolExecutor.js';

export async function checkToolsRateLimit(userId) {
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
    throw new ToolExecutionError(
      `Rate limit exceeded. Max ${RATE_LIMIT_PER_HOUR} requests per hour.`,
      'RATE_LIMIT_EXCEEDED',
      429
    );
  }
}

export async function logToolsRequest({ userId, requestPayload, responsePayload, statusCode, errorMessage }) {
  await supabaseAdmin.from('ai_requests').insert({
    user_id: userId || null,
    endpoint: '/api/tools',
    prompt_text: requestPayload ? requestPayload.slice(0, 500) : null,
    response_text: responsePayload ? responsePayload.slice(0, 1000) : null,
    status_code: statusCode,
    error_message: errorMessage || null
  });
}

function mapToolsError(error) {
  if (error instanceof ToolExecutionError) {
    return {
      statusCode: error.statusCode || 400,
      code: error.code || 'TOOL_EXECUTION_ERROR',
      message: error.message
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: error?.message || 'Internal server error'
  };
}

export async function executeToolRequest({ tool, arguments: input = {}, userId, deps = {} }) {
  const execute = deps.executeTool || executeTool;
  const { normalizedArgs, result } = await execute({
    tool,
    args: input,
    userId,
    supabaseClient: deps.supabaseClient || supabaseAdmin
  });

  return {
    success: true,
    tool_call: {
      name: tool,
      input: normalizedArgs
    },
    tool_result: result
  };
}

export function createToolsHandler(overrides = {}) {
  const deps = {
    getUserId,
    checkToolsRateLimit,
    executeToolRequest,
    logToolsRequest,
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

    let userId = null;
    let requestPayload = null;

    try {
      const body = req.body || {};

      if (typeof body.tool !== 'string' || !body.tool.trim()) {
        throw new ToolExecutionError(
          'Field "tool" is required and must be a string',
          'INVALID_ARGUMENTS',
          400
        );
      }

      userId = deps.getUserId(req);
      await deps.checkToolsRateLimit(userId);

      requestPayload = JSON.stringify(body);
      const result = await deps.executeToolRequest({
        tool: body.tool.trim(),
        arguments: body.arguments || {},
        userId
      });

      await deps
        .logToolsRequest({
          userId,
          requestPayload,
          responsePayload: JSON.stringify(result),
          statusCode: 200,
          errorMessage: null
        })
        .catch(() => {});

      return res.status(200).json(result);
    } catch (error) {
      const mappedError = mapToolsError(error);

      await deps
        .logToolsRequest({
          userId,
          requestPayload,
          responsePayload: null,
          statusCode: mappedError.statusCode,
          errorMessage: mappedError.message
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

const handler = createToolsHandler();

export default handler;

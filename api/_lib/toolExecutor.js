import { supabaseAdmin } from './supabase.js';
import { getSupportedTools, getToolDefinition } from './toolRegistry.js';
import { getWorkoutHistory } from '../../src/server/tools/getWorkoutHistory.js';
import { getExerciseProgress } from '../../src/server/tools/getExerciseProgress.js';
import { logSet } from '../../src/server/tools/logSet.js';
import { createTrainingPlan } from '../../src/server/tools/createTrainingPlan.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TOOL_HANDLERS = {
  getWorkoutHistory,
  getExerciseProgress,
  logSet,
  createTrainingPlan
};

export class ToolExecutionError extends Error {
  constructor(message, code = 'TOOL_EXECUTION_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ToolExecutionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseNumber(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new ToolExecutionError(`Argument "${field}" must be a number`, 'INVALID_ARGUMENTS', 400);
  }
  return num;
}

function normalizeArgumentValue(field, value, schema) {
  if (schema.type === 'uuid') {
    if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
      throw new ToolExecutionError(
        `Argument "${field}" must be a valid UUID`,
        'INVALID_ARGUMENTS',
        400
      );
    }
    return value;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      throw new ToolExecutionError(`Argument "${field}" must be a string`, 'INVALID_ARGUMENTS', 400);
    }
    const trimmed = value.trim();
    if (!trimmed && schema.required) {
      throw new ToolExecutionError(`Argument "${field}" is required`, 'INVALID_ARGUMENTS', 400);
    }
    if (schema.maxLength && trimmed.length > schema.maxLength) {
      throw new ToolExecutionError(
        `Argument "${field}" must have length <= ${schema.maxLength}`,
        'INVALID_ARGUMENTS',
        400
      );
    }
    return trimmed;
  }

  if (schema.type === 'number') {
    const num = parseNumber(value, field);

    if (schema.integer && !Number.isInteger(num)) {
      throw new ToolExecutionError(`Argument "${field}" must be an integer`, 'INVALID_ARGUMENTS', 400);
    }

    if (schema.min !== undefined && num < schema.min) {
      throw new ToolExecutionError(
        `Argument "${field}" must be >= ${schema.min}`,
        'INVALID_ARGUMENTS',
        400
      );
    }

    if (schema.max !== undefined && num > schema.max) {
      throw new ToolExecutionError(
        `Argument "${field}" must be <= ${schema.max}`,
        'INVALID_ARGUMENTS',
        400
      );
    }

    return num;
  }

  throw new ToolExecutionError(
    `Unsupported argument schema for "${field}"`,
    'INVALID_ARGUMENTS',
    400
  );
}

export function validateToolInput(tool, rawArgs = {}) {
  const definition = getToolDefinition(tool);

  if (!definition) {
    throw new ToolExecutionError(
      `Unsupported tool "${tool}". Supported tools: ${getSupportedTools().join(', ')}`,
      'INVALID_TOOL',
      400
    );
  }

  if (!isObject(rawArgs)) {
    throw new ToolExecutionError('Field "arguments" must be an object', 'INVALID_ARGUMENTS', 400);
  }

  const schemaEntries = Object.entries(definition.args || {});
  const allowedFields = new Set(schemaEntries.map(([name]) => name));

  for (const field of Object.keys(rawArgs)) {
    if (!allowedFields.has(field)) {
      throw new ToolExecutionError(
        `Unknown argument "${field}" for tool "${tool}"`,
        'INVALID_ARGUMENTS',
        400
      );
    }
  }

  const normalizedArgs = {};

  for (const [field, schema] of schemaEntries) {
    const value = rawArgs[field];

    if (value === undefined || value === null || value === '') {
      if (schema.required) {
        throw new ToolExecutionError(`Argument "${field}" is required`, 'INVALID_ARGUMENTS', 400);
      }

      if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
        normalizedArgs[field] = schema.default;
      }
      continue;
    }

    const normalized = normalizeArgumentValue(field, value, schema);

    if (schema.enum && !schema.enum.includes(normalized)) {
      throw new ToolExecutionError(
        `Argument "${field}" must be one of: ${schema.enum.join(', ')}`,
        'INVALID_ARGUMENTS',
        400
      );
    }

    normalizedArgs[field] = normalized;
  }

  return normalizedArgs;
}

export async function executeTool({ tool, args = {}, userId, supabaseClient = supabaseAdmin }) {
  const handler = TOOL_HANDLERS[tool];

  if (!handler) {
    throw new ToolExecutionError(
      `No handler implemented for tool "${tool}"`,
      'INVALID_TOOL',
      400
    );
  }

  const normalizedArgs = validateToolInput(tool, args);

  try {
    const result = await handler({
      supabaseAdmin: supabaseClient,
      userId,
      args: normalizedArgs
    });

    return {
      normalizedArgs,
      result
    };
  } catch (error) {
    if (error instanceof ToolExecutionError) {
      throw error;
    }

    throw new ToolExecutionError(error.message || 'Tool execution failed', 'TOOL_EXECUTION_FAILED', 500);
  }
}

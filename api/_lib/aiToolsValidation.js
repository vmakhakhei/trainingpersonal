import { getToolDefinition, getSupportedToolNames } from './aiToolsRegistry.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ToolValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ToolValidationError';
    this.code = code;
    this.statusCode = 400;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseIntegerArg(name, value, schema) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new ToolValidationError(`Argument "${name}" must be an integer`);
  }

  if (parsed < schema.min || parsed > schema.max) {
    throw new ToolValidationError(
      `Argument "${name}" must be between ${schema.min} and ${schema.max}`
    );
  }

  return parsed;
}

function parseUuidArg(name, value) {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new ToolValidationError(`Argument "${name}" must be a valid UUID`);
  }
  return value;
}

export function validateToolRequest(body) {
  if (!isObject(body)) {
    throw new ToolValidationError('Request body must be a JSON object');
  }

  const { tool, arguments: rawArgs = {} } = body;

  if (typeof tool !== 'string' || !tool.trim()) {
    throw new ToolValidationError('Field "tool" is required and must be a string');
  }

  const toolName = tool.trim();
  const definition = getToolDefinition(toolName);

  if (!definition) {
    const supported = getSupportedToolNames().join(', ');
    throw new ToolValidationError(
      `Unsupported tool "${toolName}". Supported tools: ${supported}`,
      'UNSUPPORTED_TOOL'
    );
  }

  if (!isObject(rawArgs)) {
    throw new ToolValidationError('Field "arguments" must be an object');
  }

  const allowedArgNames = Object.keys(definition.args);
  const incomingArgNames = Object.keys(rawArgs);
  const unknownArgs = incomingArgNames.filter((name) => !allowedArgNames.includes(name));

  if (unknownArgs.length > 0) {
    throw new ToolValidationError(
      `Unknown arguments for tool "${toolName}": ${unknownArgs.join(', ')}`
    );
  }

  const normalizedArgs = {};

  for (const [argName, schema] of Object.entries(definition.args)) {
    const incomingValue = rawArgs[argName];

    if (incomingValue === undefined || incomingValue === null || incomingValue === '') {
      if (schema.required) {
        throw new ToolValidationError(`Argument "${argName}" is required`);
      }

      if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
        normalizedArgs[argName] = schema.default;
      }
      continue;
    }

    if (schema.type === 'integer') {
      normalizedArgs[argName] = parseIntegerArg(argName, incomingValue, schema);
      continue;
    }

    if (schema.type === 'uuid') {
      normalizedArgs[argName] = parseUuidArg(argName, incomingValue);
      continue;
    }

    throw new ToolValidationError(`Unsupported schema type for argument "${argName}"`);
  }

  return {
    tool: toolName,
    arguments: normalizedArgs
  };
}

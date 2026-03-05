const DEFAULT_CACHE_TTL_HOURS = 72;
const DEFAULT_RATE_LIMIT_PER_HOUR = 60;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export const CACHE_TTL_HOURS = parsePositiveInteger(
  process.env.CACHE_TTL_HOURS,
  DEFAULT_CACHE_TTL_HOURS
);

export const RATE_LIMIT_PER_HOUR = parsePositiveInteger(
  process.env.RATE_LIMIT_PER_HOUR,
  DEFAULT_RATE_LIMIT_PER_HOUR
);

export const DEEPSEEK_API_URL =
  process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

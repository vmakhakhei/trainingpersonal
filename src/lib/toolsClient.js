const DEFAULT_TOOLS_API_URL = '/api/tools';

function getRuntimeEnv() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env;
  }

  return {};
}

export function getToolsApiUrl() {
  const env = getRuntimeEnv();
  const configuredUrl = typeof env.VITE_TOOLS_API_URL === 'string' ? env.VITE_TOOLS_API_URL.trim() : '';
  return configuredUrl || DEFAULT_TOOLS_API_URL;
}

function isLikelyLocalApiPath(url) {
  return typeof url === 'string' && url.startsWith('/api/');
}

export async function parseToolsApiResponse(response, endpoint = DEFAULT_TOOLS_API_URL) {
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    if (isLikelyLocalApiPath(endpoint)) {
      throw new Error(
        'Tools API вернул пустой ответ. В Vite dev /api/* не исполняется. Укажите VITE_TOOLS_API_URL (например, https://onlinetrainer.vercel.app/api/tools) или используйте vercel dev.'
      );
    }

    throw new Error('Tools API вернул пустой ответ');
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    if (isLikelyLocalApiPath(endpoint) && !contentType.includes('application/json')) {
      throw new Error(
        'Tools API вернул не-JSON ответ. В Vite dev /api/* не исполняется. Укажите VITE_TOOLS_API_URL или используйте vercel dev.'
      );
    }

    throw new Error('Tools API вернул некорректный JSON');
  }
}

export async function callToolsApi({ tool, arguments: toolArguments = {}, fetchImpl = fetch, endpoint }) {
  const targetEndpoint = endpoint || getToolsApiUrl();

  const response = await fetchImpl(targetEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tool,
      arguments: toolArguments
    })
  });

  const payload = await parseToolsApiResponse(response, targetEndpoint);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Tools API request failed (${response.status})`);
  }

  return payload;
}

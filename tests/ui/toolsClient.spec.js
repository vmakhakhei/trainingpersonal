import { describe, expect, it, vi } from 'vitest';
import { callToolsApi, parseToolsApiResponse } from '../../src/lib/toolsClient.js';

function createResponse({ status = 200, ok = true, contentType = 'application/json', body = '{}' }) {
  return {
    status,
    ok,
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null)
    },
    text: async () => body
  };
}

describe('tools client', () => {
  it('calls tools endpoint and parses successful payload', async () => {
    const fetchMock = vi.fn(async () =>
      createResponse({
        status: 200,
        ok: true,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tool_call: { name: 'createTrainingPlan', input: { goal: 'strength' } },
          tool_result: { id: 'plan-1' }
        })
      })
    );

    const result = await callToolsApi({
      tool: 'createTrainingPlan',
      arguments: { goal: 'strength' },
      fetchImpl: fetchMock,
      endpoint: 'https://onlinetrainer.vercel.app/api/tools'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://onlinetrainer.vercel.app/api/tools');
    expect(options.method).toBe('POST');
    expect(result.success).toBe(true);
  });

  it('throws readable error for empty local /api/tools response', async () => {
    await expect(
      parseToolsApiResponse(
        createResponse({ status: 502, ok: false, contentType: 'text/html', body: '' }),
        '/api/tools'
      )
    ).rejects.toThrow('Vite dev');
  });

  it('throws readable error for non-json local /api/tools response', async () => {
    await expect(
      parseToolsApiResponse(
        createResponse({ status: 502, ok: false, contentType: 'text/html', body: '<html>bad</html>' }),
        '/api/tools'
      )
    ).rejects.toThrow('не-JSON');
  });
});

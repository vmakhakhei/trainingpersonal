import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const vercelConfigPath = new URL('../../vercel.json', import.meta.url);

function getConfig() {
  return JSON.parse(readFileSync(vercelConfigPath, 'utf8'));
}

test('vercel.json has expected build targets', () => {
  const config = getConfig();

  assert.equal(config.version, 2);
  assert.ok(
    config.builds.some(
      (build) =>
        build.src === 'package.json' &&
        build.use === '@vercel/static-build' &&
        build.config?.distDir === 'dist'
    )
  );

  assert.ok(
    config.builds.some((build) => build.src === 'api/tools.js' && build.use === '@vercel/node')
  );

  assert.ok(
    config.builds.some((build) => build.src === 'api/ai/*.js' && build.use === '@vercel/node')
  );

  assert.ok(
    config.builds.some(
      (build) => build.src === 'api/analytics/index.js' && build.use === '@vercel/node'
    )
  );
});

test('vercel.json has tools canonical route and alias', () => {
  const config = getConfig();

  const canonicalRoute = config.routes.find((route) => route.src === '/api/tools');
  const aliasRoute = config.routes.find((route) => route.src === '/api/ai/tools');
  const proxyRoute = config.routes.find((route) => route.src === '/api/ai/proxy');
  const suggestRoute = config.routes.find((route) => route.src === '/api/ai/suggest');
  const analyticsRoute = config.routes.find((route) => route.src === '/api/analytics');

  assert.ok(canonicalRoute);
  assert.equal(canonicalRoute.dest, '/api/tools.js');

  assert.ok(aliasRoute);
  assert.equal(aliasRoute.dest, '/api/tools.js');

  assert.ok(proxyRoute);
  assert.equal(proxyRoute.dest, '/api/ai/proxy.js');

  assert.ok(suggestRoute);
  assert.equal(suggestRoute.dest, '/api/ai/suggest.js');

  assert.ok(analyticsRoute);
  assert.equal(analyticsRoute.dest, '/api/analytics/index.js');
});

test('vercel.json keeps SPA fallback and security headers', () => {
  const config = getConfig();

  const spaFallbackRoute = config.routes.find((route) => route.src === '/(.*)');
  assert.ok(spaFallbackRoute);
  assert.equal(spaFallbackRoute.dest, '/index.html');

  assert.ok(Array.isArray(config.headers));
  const globalHeaders = config.headers.find((item) => item.source === '/(.*)');
  assert.ok(globalHeaders);

  const headerKeys = globalHeaders.headers.map((header) => header.key);
  assert.ok(headerKeys.includes('Content-Security-Policy'));
  assert.ok(headerKeys.includes('Referrer-Policy'));
  assert.ok(headerKeys.includes('X-Frame-Options'));
  assert.ok(headerKeys.includes('X-Content-Type-Options'));
});

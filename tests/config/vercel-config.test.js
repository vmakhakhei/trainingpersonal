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
    config.builds.some(
      (build) => build.src === 'api/**/*.js' && build.use === '@vercel/node'
    )
  );
});

test('vercel.json forwards /api routes and keeps SPA fallback', () => {
  const config = getConfig();

  const apiRoute = config.routes.find((route) => route.src === '/api/(.*)');
  const spaFallbackRoute = config.routes.find((route) => route.src === '/(.*)');

  assert.ok(apiRoute);
  assert.equal(apiRoute.dest, '/api/$1');

  assert.ok(spaFallbackRoute);
  assert.equal(spaFallbackRoute.dest, '/index.html');
});

test('vercel.json keeps security headers', () => {
  const config = getConfig();

  assert.ok(Array.isArray(config.headers));
  const globalHeaders = config.headers.find((item) => item.source === '/(.*)');
  assert.ok(globalHeaders);

  const headerKeys = globalHeaders.headers.map((header) => header.key);
  assert.ok(headerKeys.includes('Content-Security-Policy'));
  assert.ok(headerKeys.includes('Referrer-Policy'));
  assert.ok(headerKeys.includes('X-Frame-Options'));
  assert.ok(headerKeys.includes('X-Content-Type-Options'));
});

#!/usr/bin/env node
// Exercise the production Next router using disposable local accounts/upstreams.
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.on('uncaughtExceptionMonitor', () => { process.exitCode = 1; });
process.on('unhandledRejection', error => {
  process.exitCode = 1;
  console.error('Unexpected server rejection:', error);
});
const directory = await mkdtemp(join(tmpdir(), 'avrone-route-verify-'));
const key = randomBytes(32).toString('base64url');
const salt = randomBytes(16);
const keyHash = ['scrypt', 16384, 8, 1, salt.toString('base64url'),
  scryptSync(key, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('base64url')].join('$');

for (const name of Object.keys(process.env)) {
  if (name.startsWith('CONTROL704_') || name === 'AVRONE_AUTH_SECRET') delete process.env[name];
}
process.env.NODE_ENV = 'production';
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.AVRONE_AUTH_SECRET = randomBytes(48).toString('base64url');
process.env.CONTROL704_ACCOUNTS = JSON.stringify([{ id: 'local-verify', role: 'admin', keyHash }]);
process.env.CONTROL704_AUDIT_PATH = join(directory, 'audit.jsonl');
process.env.CONTROL704_OVERRIDE_PATH = join(directory, 'overrides.json');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}
async function close(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
  });
}

const received = [];
const upstream = createServer((req, res) => {
  received.push({ method: req.method, path: req.url });
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(received.at(-1)));
});
let app;
let server;
try {
  const upstreamPort = await listen(upstream);
  process.env.CONTROL704_PROXY_ALLOW_HTTP = '1';
  process.env.CONTROL704_PROXY_X_URL = 'http://127.0.0.1:' + upstreamPort;
  const next = (await import('next')).default;
  app = next({ dev: false, dir: root, hostname: '127.0.0.1', port: 0 });
  await app.prepare();
  server = createServer(app.getRequestHandler());
  const port = await listen(server);
  const base = 'http://127.0.0.1:' + port;
  const request = (path, options = {}) => fetch(base + path, {
    ...options,
    headers: { connection: 'close', ...options.headers },
    redirect: 'manual',
    signal: AbortSignal.timeout(5000)
  });
  const checks = [];
  const denied = await request('/api/proxy/x/health');
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error, 'unauthenticated');
  assert.equal(received.length, 0);
  checks.push('unauthenticated request has no upstream effect');

  const login = await request('/api/control704/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'local-verify', key })
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).ok, true);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('c704_session='));
  checks.push('disposable account authenticates through the actual login route');

  const proxied = await request('/api/proxy/x/health/deep?sample=1', { headers: { cookie } });
  assert.equal(proxied.status, 200);
  assert.deepEqual(await proxied.json(), { method: 'GET', path: '/health/deep?sample=1' });
  checks.push('asynchronous target and optional path resolve and forward the query');

  const head = await request('/api/proxy/x/health', { method: 'HEAD', headers: { cookie } });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(received.at(-1).method, 'HEAD');
  checks.push('HEAD preserves its method and returns an empty body');

  const count = received.length;
  const unknown = await request('/api/proxy/unknown/health', { headers: { cookie } });
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error, 'unknown_target');
  assert.equal(received.length, count);
  checks.push('unknown targets never reach the local upstream');

  const crossSite = await request('/api/proxy/x/health', {
    method: 'POST', headers: { cookie, origin: 'https://untrusted.invalid' }, body: '{}'
  });
  assert.equal(crossSite.status, 403);
  assert.equal((await crossSite.json()).error, 'cross_origin_blocked');
  assert.equal(received.length, count);
  checks.push('cross-origin writes are rejected before proxy forwarding');
  console.log(JSON.stringify({ schema: 'avrone.production-proxy-verification.v1', ok: true, checks }, null, 2));
} finally {
  await close(server);
  await app?.close();
  await close(upstream);
  await rm(directory, { recursive: true, force: true });
}

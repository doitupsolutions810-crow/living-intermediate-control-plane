import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = {
  schema: 'great-scale.descent/v0.4.2',
  sourceVersion: 'great-scale/public/scale.js@a0fd4b10b964932f90abf7004bbe7e28687168d1',
  running: true,
  t: 8,
  x: 4.25,
  k: 0.25,
  nearFixed: false,
  residual: 0.5,
  residualNormalized: 0.5 / 7,
  historyLen: 8,
  last: {
    t: 8,
    x: 4.25,
    S: (4.25 / 9) * (1 - 4.25 / 9),
    residual: 0.5,
    residualNormalized: 0.5 / 7,
    nearFixed: false,
    involution: 4.75
  },
  universe_id: 'U1',
  cycle_count: 8,
  stress_residual_normalized: 0.5 / 7
};

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function waitForPlatform(baseUrl, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Platform exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('Platform did not become healthy in time');
}

test('authenticated scale route proxies valid upstream data and fails closed on outage', async () => {
  let upstreamUnavailable = false;
  const observedAuthorization = [];
  const upstream = createServer((req, res) => {
    observedAuthorization.push(req.headers.authorization);
    if (upstreamUnavailable) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unavailable' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(snapshot));
  });
  const upstreamPort = await listen(upstream);
  const portProbe = createServer();
  const platformPort = await listen(portProbe);
  await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));

  const stateRoot = await mkdtemp(path.join(os.tmpdir(), 'cyclekernel-scale-route-'));
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: platformRoot,
    env: {
      ...process.env,
      CONTROL12_PLATFORM_HOST: '127.0.0.1',
      CONTROL12_PLATFORM_PORT: String(platformPort),
      CONTROL12_PLATFORM_ROOT: stateRoot,
      CONTROL12_CODE_WORKSPACE: path.join(stateRoot, 'workspace'),
      CONTROL12_PLATFORM_TOKEN: 'platform-secret',
      CONTROL12_CHAT_OPEN: '1',
      CYCLEKERNEL_SCALE_URL: `http://127.0.0.1:${upstreamPort}/api/v1/scale/state`,
      CYCLEKERNEL_SCALE_TOKEN: 'cycle-secret'
    },
    stdio: 'ignore'
  });
  const baseUrl = `http://127.0.0.1:${platformPort}`;

  try {
    await waitForPlatform(baseUrl, child);

    const unauthenticated = await fetch(`${baseUrl}/api/v1/scale/state`);
    assert.equal(unauthenticated.status, 401);

    const authorized = await fetch(`${baseUrl}/api/v1/scale/state`, {
      headers: { authorization: 'Bearer platform-secret' }
    });
    assert.equal(authorized.status, 200);
    assert.deepEqual(await authorized.json(), snapshot);
    assert.deepEqual(observedAuthorization, ['Bearer cycle-secret']);

    upstreamUnavailable = true;
    const unavailable = await fetch(`${baseUrl}/api/v1/scale/state`, {
      headers: { authorization: 'Bearer platform-secret' }
    });
    assert.equal(unavailable.status, 502);
    assert.equal((await unavailable.json()).code, 'CYCLEKERNEL_UNAVAILABLE');
    assert.deepEqual(observedAuthorization, ['Bearer cycle-secret', 'Bearer cycle-secret']);
  } finally {
    const alreadyExited = child.exitCode !== null || child.signalCode !== null;
    const childExit = alreadyExited ? Promise.resolve() : once(child, 'exit');
    if (!alreadyExited) child.kill('SIGKILL');
    await childExit;
    await new Promise((resolve) => upstream.close(resolve));
    await rm(stateRoot, { recursive: true, force: true });
  }
});

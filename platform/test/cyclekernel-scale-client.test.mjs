import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { createCycleKernelScaleClient } from '../src/bridge/cyclekernel-scale-client.mjs';

const snapshot = {
  schema: 'great-scale.descent/v0.4.2',
  sourceVersion: 'great-scale/public/scale.js@a0fd4b10b964932f90abf7004bbe7e28687168d1',
  running: false,
  t: 3,
  x: 4.5,
  k: 0.5,
  nearFixed: true,
  residual: 0,
  residualNormalized: 0,
  historyLen: 3,
  last: {
    t: 3,
    x: 4.5,
    S: (4.5 / 9) * (1 - 4.5 / 9),
    residual: 0,
    residualNormalized: 0,
    nearFixed: true,
    involution: 4.5
  },
  universe_id: 'U1',
  cycle_count: 3,
  stress_residual_normalized: 0
};

async function withServer(handler, run) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}/api/v1/scale/state`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('sends bearer auth and returns a validated CycleKernal snapshot', async () => {
  await withServer((req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/api/v1/scale/state');
    assert.equal(req.headers.authorization, 'Bearer cycle-secret');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(snapshot));
  }, async (endpoint) => {
    const getState = createCycleKernelScaleClient({ endpoint, token: 'cycle-secret' });
    assert.deepEqual(await getState(), snapshot);
  });
});

test('fails closed when the upstream token is missing', async () => {
  const getState = createCycleKernelScaleClient({ endpoint: 'https://cycle.example/api/v1/scale/state' });
  await assert.rejects(getState, { statusCode: 503, code: 'SCALE_BRIDGE_NOT_CONFIGURED' });
});

test('rejects non-loopback cleartext endpoints', async () => {
  const getState = createCycleKernelScaleClient({ endpoint: 'http://cycle.example/api/v1/scale/state', token: 'secret' });
  await assert.rejects(getState, { statusCode: 503, code: 'SCALE_BRIDGE_INVALID_URL' });
});

test('rejects snapshots outside the declared schema', async () => {
  await withServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ...snapshot, schema: 'great-scale.readiness/v1' }));
  }, async (endpoint) => {
    const getState = createCycleKernelScaleClient({ endpoint, token: 'cycle-secret' });
    await assert.rejects(getState, { statusCode: 502, code: 'CYCLEKERNEL_INVALID_RESPONSE' });
  });
});

test('rejects snapshots whose provenance or residual math is inconsistent', async () => {
  const inconsistentSnapshots = [
    { ...snapshot, sourceVersion: 'unverified-source' },
    { ...snapshot, sourceVersion: 'great-scale/public/scale.js@unverified-suffix' },
    { ...snapshot, universe_id: 'U2' },
    { ...snapshot, unexpected: true },
    { ...snapshot, residual: 1, residualNormalized: 1 / 7, stress_residual_normalized: 1 / 7 },
    { ...snapshot, cycle_count: 2 },
    { ...snapshot, last: { ...snapshot.last, x: 4.25 } },
    { ...snapshot, last: { ...snapshot.last, S: 0.5 } },
    { ...snapshot, last: { ...snapshot.last, involution: 4.25 } }
  ];

  for (const invalidSnapshot of inconsistentSnapshots) {
    await withServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(invalidSnapshot));
    }, async (endpoint) => {
      const getState = createCycleKernelScaleClient({ endpoint, token: 'cycle-secret' });
      await assert.rejects(getState, { statusCode: 502, code: 'CYCLEKERNEL_INVALID_RESPONSE' });
    });
  }
});

test('rejects non-JSON and oversized upstream responses', async () => {
  await withServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>not json</html>');
  }, async (endpoint) => {
    const getState = createCycleKernelScaleClient({ endpoint, token: 'cycle-secret' });
    await assert.rejects(getState, { statusCode: 502, code: 'CYCLEKERNEL_INVALID_RESPONSE' });
  });

  await withServer((_req, res) => {
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-length': String(65 * 1024)
    });
    res.end('{}');
  }, async (endpoint) => {
    const getState = createCycleKernelScaleClient({ endpoint, token: 'cycle-secret' });
    await assert.rejects(getState, { statusCode: 502, code: 'CYCLEKERNEL_INVALID_RESPONSE' });
  });
});

test('does not follow upstream redirects', async () => {
  let redirectTargetReached = false;
  const target = createServer((_req, res) => {
    redirectTargetReached = true;
    res.end(JSON.stringify(snapshot));
  });
  target.listen(0, '127.0.0.1');
  await once(target, 'listening');
  try {
    await withServer((_req, res) => {
      res.writeHead(302, { location: `http://127.0.0.1:${target.address().port}/` });
      res.end();
    }, async (endpoint) => {
      const getState = createCycleKernelScaleClient({ endpoint, token: 'cycle-secret' });
      await assert.rejects(getState, { statusCode: 502, code: 'CYCLEKERNEL_UNAVAILABLE' });
    });
    assert.equal(redirectTargetReached, false);
  } finally {
    target.close();
    await once(target, 'close');
  }
});

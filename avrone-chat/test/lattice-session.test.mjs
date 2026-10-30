import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchLatticeSessionTurn } from '../lib/lattice-session.mjs';

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
});

test('creates a platform session and turns with the returned identity', async () => {
  const calls = [];
  const result = await fetchLatticeSessionTurn({
    baseUrl: 'http://lattice.test',
    headers: {},
    message: 'first turn',
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return url.endsWith('/chat/session')
        ? response(201, { id: 'session-1' })
        : response(200, { systemAugment: 'lattice context', frame: { belief: 0.6 } });
    }
  });

  assert.equal(result.offline, false);
  assert.equal(result.sessionId, 'session-1');
  assert.equal(result.systemAugment, 'lattice context');
  assert.deepEqual(result.spectrum, { belief: 0.6 });
  assert.deepEqual(
    calls.map(call => call.url.split('/').pop()),
    ['session', 'turn']
  );
  assert.equal(calls[1].body.sessionId, 'session-1');
});

test('reuses the supplied session for later conversation turns', async () => {
  const calls = [];
  const result = await fetchLatticeSessionTurn({
    baseUrl: 'http://lattice.test',
    headers: {},
    message: 'second turn',
    sessionId: 'session-1',
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return response(200, { systemAugment: 'continued context' });
    }
  });

  assert.equal(result.sessionId, 'session-1');
  assert.equal(result.offline, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith('/chat/turn'), true);
  assert.equal(calls[0].body.sessionId, 'session-1');
});

test('creates a new session when the prior in-memory session has expired', async () => {
  const calls = [];
  const result = await fetchLatticeSessionTurn({
    baseUrl: 'http://lattice.test',
    headers: {},
    message: 'continue after restart',
    sessionId: 'expired-session',
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      if (url.endsWith('/chat/turn') && body.sessionId === 'expired-session') {
        return response(404, { error: 'unknown session' });
      }
      if (url.endsWith('/chat/session')) return response(201, { id: 'session-2' });
      return response(200, { systemAugment: 'recovered' });
    }
  });

  assert.equal(result.sessionId, 'session-2');
  assert.equal(result.offline, false);
  assert.deepEqual(
    calls.map(call => [call.url.split('/').pop(), call.body.sessionId || null]),
    [
      ['turn', 'expired-session'],
      ['session', null],
      ['turn', 'session-2']
    ]
  );
});

test('reports rejected turns without claiming an active session', async () => {
  const result = await fetchLatticeSessionTurn({
    baseUrl: 'http://lattice.test',
    headers: {},
    message: 'unauthorized turn',
    sessionId: 'session-1',
    fetchImpl: async () => response(401, { error: 'unauthorized' })
  });

  assert.equal(result.offline, true);
  assert.equal(result.sessionId, undefined);
  assert.match(result.systemAugment, /HTTP 401/);
});

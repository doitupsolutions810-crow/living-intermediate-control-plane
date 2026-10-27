import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchProductionAcceptanceAttestation } from '../lib/production-acceptance-fetch.mjs';

const URL = 'https://evidence.example.test/api/production-acceptance';
const payload = JSON.stringify({ schema: 'great-scale.production-acceptance/v1', marker: 'fixture' });

function makeResponse(body = payload, {
  status = 200,
  contentType = 'application/json',
  finalUrl = URL,
  redirected = false,
  contentLength,
} = {}) {
  const headers = { 'content-type': contentType };
  if (contentLength !== undefined) headers['content-length'] = String(contentLength);
  const response = new Response(body, { status, headers });
  Object.defineProperty(response, 'url', { value: finalUrl });
  Object.defineProperty(response, 'redirected', { value: redirected });
  return response;
}

function fetchReturning(response, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    return response;
  };
}

test('accepts bounded JSON only from the exact configured HTTPS URL', async () => {
  const calls = [];
  const result = await fetchProductionAcceptanceAttestation({
    url: URL,
    fetchImpl: fetchReturning(makeResponse(), calls),
  });
  assert.deepEqual(result, { schema: 'great-scale.production-acceptance/v1', marker: 'fixture' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, URL);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.headers.accept, 'application/json');
  assert.equal(calls[0].options.headers['cache-control'], 'no-cache');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('rejects missing, malformed, non-HTTPS, credentialed, and fragment URLs before network access', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return makeResponse(); };
  for (const url of [undefined, '', 'not-a-url', 'http://evidence.example.test/a',
    'https://user:secret@evidence.example.test/a', 'https://evidence.example.test/a#fragment']) {
    assert.equal(await fetchProductionAcceptanceAttestation({ url, fetchImpl }), null, String(url));
  }
  assert.equal(calls, 0);
});

test('rejects redirected responses and any final URL mismatch', async () => {
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, fetchImpl: fetchReturning(makeResponse(payload, { redirected: true })),
  }), null);
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, fetchImpl: fetchReturning(makeResponse(payload, { finalUrl: 'https://other.example.test/a' })),
  }), null);
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, fetchImpl: fetchReturning(makeResponse(payload, { finalUrl: '' })),
  }), null);
});

test('rejects HTTP failures and non-JSON content types', async () => {
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, fetchImpl: fetchReturning(makeResponse(payload, { status: 503 })),
  }), null);
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, fetchImpl: fetchReturning(makeResponse(payload, { contentType: 'text/html' })),
  }), null);
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, fetchImpl: fetchReturning(makeResponse(payload, { contentType: 'application/problem+json' })),
  }), null);
});

test('rejects malformed JSON, arrays, and primitive JSON values', async () => {
  for (const value of ['{bad json', '[]', 'null', '42', '"string"']) {
    assert.equal(await fetchProductionAcceptanceAttestation({
      url: URL, fetchImpl: fetchReturning(makeResponse(value)),
    }), null, value);
  }
});

test('rejects oversized Content-Length before parsing', async () => {
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, maxBytes: 8,
    fetchImpl: fetchReturning(makeResponse(payload, { contentLength: Buffer.byteLength(payload) })),
  }), null);
});

test('rejects a response body that exceeds the byte cap even when Content-Length is absent', async () => {
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, maxBytes: 8,
    fetchImpl: fetchReturning(makeResponse(payload)),
  }), null);
});

test('rejects invalid size limits rather than silently widening them', async () => {
  for (const maxBytes of [0, -1, 1.2, 300 * 1024]) {
    assert.equal(await fetchProductionAcceptanceAttestation({
      url: URL, maxBytes, fetchImpl: fetchReturning(makeResponse()),
    }), null);
  }
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, timeoutMs: 0, fetchImpl: fetchReturning(makeResponse()),
  }), null);
});

test('network timeout returns no attestation', async () => {
  const fetchImpl = (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted by timeout')), { once: true });
  });
  assert.equal(await fetchProductionAcceptanceAttestation({
    url: URL, timeoutMs: 10, fetchImpl,
  }), null);
});

console.log('production-acceptance-fetch.test.mjs: 9/9 cases defined');

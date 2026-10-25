import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSecureBinding, requireAuth } from '../src/http/router.mjs';

test('tokenless development binding is allowed on loopback', () => {
  assert.doesNotThrow(() => assertSecureBinding('127.0.0.1', ''));
  assert.doesNotThrow(() => assertSecureBinding('127.0.0.2', ''));
  assert.doesNotThrow(() => assertSecureBinding('localhost', ''));
  assert.doesNotThrow(() => assertSecureBinding('::1', ''));
});

test('non-loopback binding fails closed without a bearer token', () => {
  for (const host of [
    '0.0.0.0',
    '192.0.2.10',
    '::',
    '127.example.com',
    '127.attacker.test',
    '127.0.0.1.evil'
  ]) {
    assert.throws(
      () => assertSecureBinding(host, ''),
      /CONTROL12_PLATFORM_TOKEN is required/
    );
  }
});

test('non-loopback binding is allowed when a token is configured', () => {
  assert.doesNotThrow(() => assertSecureBinding('0.0.0.0', 'test-token'));
});

test('configured bearer token is enforced', () => {
  assert.throws(
    () => requireAuth({ headers: {} }, 'expected-token'),
    (error) => error.statusCode === 401
  );
  assert.throws(
    () => requireAuth({ headers: { authorization: 'Bearer wrong' } }, 'expected-token'),
    (error) => error.statusCode === 401
  );
  assert.doesNotThrow(() =>
    requireAuth({ headers: { authorization: 'Bearer expected-token' } }, 'expected-token')
  );
});

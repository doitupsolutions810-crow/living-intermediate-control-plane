import test from 'node:test';
import assert from 'node:assert/strict';
import { providerFailurePayload } from '../lib/chat-errors.mjs';

test('provider failures have a stable error shape and redact credential-like values', () => {
  const payload = providerFailurePayload(new Error('authorization: Bearer abc123 failed'));
  assert.equal(payload.error, 'provider_error');
  assert.match(payload.message, /could not complete this turn/);
  assert.doesNotMatch(payload.message, /abc123/);
});

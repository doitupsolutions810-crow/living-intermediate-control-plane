import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeProcurement } from '../lib/evidence-authorization.mjs';

test('verified public evidence authorizes a ready core', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'ok',
    evidenceAuthority: 'public',
    localEvidenceAccepted: false
  });
  assert.equal(result.authorized, true);
  assert.equal(result.reason, 'public-evidence-verified');
});

test('explicit local opt-in authorizes fallback evidence', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'unreachable',
    evidenceAuthority: 'local',
    localEvidenceAccepted: true
  });
  assert.equal(result.authorized, true);
  assert.equal(result.reason, 'explicit-local-opt-in');
});

test('force flag cannot substitute for evidence authorization', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'unreachable',
    evidenceAuthority: 'local',
    localEvidenceAccepted: false,
    force: true
  });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, 'evidence-not-authorized');
});

test('unknown authority fails closed even if status says ok', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'ok',
    evidenceAuthority: 'unknown',
    localEvidenceAccepted: false
  });
  assert.equal(result.authorized, false);
});

test('core readiness remains mandatory with valid public evidence', () => {
  const result = authorizeProcurement({
    coreReady: false,
    evidenceStatus: 'ok',
    evidenceAuthority: 'public',
    localEvidenceAccepted: false
  });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, 'core-not-ready');
});

test('explicit local opt-in cannot bypass core readiness', () => {
  const result = authorizeProcurement({
    coreReady: false,
    evidenceStatus: 'unreachable',
    evidenceAuthority: 'local',
    localEvidenceAccepted: true
  });
  assert.equal(result.authorized, false);
});

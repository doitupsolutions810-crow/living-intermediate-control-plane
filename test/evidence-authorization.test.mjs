import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeProcurement } from '../lib/evidence-authorization.mjs';

test('verified public evidence authorizes a ready core', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'ok',
    evidenceAuthority: 'public',
    trustContractVerified: true,
    localEvidenceAccepted: false
  });
  assert.equal(result.authorized, true);
  assert.equal(result.reason, 'public-evidence-contract-verified');
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

test('local opt-in cannot turn an unknown authority into a local fallback', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'ok',
    evidenceAuthority: 'unknown',
    localEvidenceAccepted: true
  });
  assert.equal(result.authorized, false);
  assert.equal(result.localFallbackObserved, false);
});

test('local opt-in cannot authorize a public-status response marked local', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'ok',
    evidenceAuthority: 'local',
    localEvidenceAccepted: true
  });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, 'local-fallback-state-unverified');
});

test('explicit local opt-in still requires a recognized degraded status', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'unknown',
    evidenceAuthority: 'local',
    localEvidenceAccepted: true
  });
  assert.equal(result.authorized, false);
});

test('public HTTP success without explicit contract verification is denied', () => {
  const result = authorizeProcurement({
    coreReady: true,
    evidenceStatus: 'ok',
    evidenceAuthority: 'public',
    trustContractVerified: false,
    localEvidenceAccepted: false
  });
  assert.equal(result.authorized, false);
  assert.equal(result.publicEvidenceContractVerified, false);
});

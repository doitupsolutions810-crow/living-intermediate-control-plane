import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGreatScaleEvidence, GREAT_SCALE_CONE } from '../src/bridge/great-scale-evidence.mjs';

function envelope(overrides = {}) {
  return {
    schema: 'great-scale.evidence/v1',
    claim_id: 'GS-DESCENT-XCIV-test',
    producer: { repository: 'owner/great-scale', commit: 'c'.repeat(40), path: 'research/topological-qgt.cjs', runtime: { node: '20', python: '3' } },
    model: { name: 'Qi-Wu-Zhang', parameters: { m: -1, grid_size: 80, grid_origin: 'midpoint' }, conventions: { band: 'lower', orientation: 'declared' } },
    claim: { class: 'numerical-model-result', formula_version: 'qgt-topological/v1', assumptions: ['gapped', 'pure-two-band', 'periodic-Brillouin-zone'] },
    result: { chern_number: -1, metric_area_budget: 2, metric_area_excess: 1, topological_saturation: 0.5, great_scale_scalar: GREAT_SCALE_CONE + 0.1875 },
    validation: { domain_valid: true, chern_integer_residual: 0, signed_curvature_residual: 0, area_refinement_residual: 0, grid_origin_residual: 0, cancellation_residual: 0, entropy_residual: 0, converged: true, acceptance: 'provisional' },
    execution: { command: 'npm test', exit_code: null, workflow_run_url: null, log_digest: null },
    integrity: { canonicalization: 'RFC8785-or-versioned-canonical-json', artifact_digest: null, signature_ref: null },
    authorization: { status: 'not_requested', capability_ref: null, audience: null, operation: null, expires_at: null, verification_ref: null },
    ...overrides
  };
}

function acceptedEnvelope() {
  const e = envelope();
  e.validation.acceptance = 'accepted';
  e.execution.exit_code = 0;
  e.integrity.artifact_digest = 'a'.repeat(64);
  e.integrity.signature_ref = 'sigstore://example/attestation/123';
  e.authorization = {
    status: 'authorized',
    capability_ref: 'capability://control-plane/cap-123',
    audience: 'living-intermediate-control-plane',
    operation: 'publish-great-scale-evidence',
    expires_at: '2099-01-01T00:00:00.000Z',
    verification_ref: 'verification://authority/check-456'
  };
  return e;
}

test('valid provisional evidence envelope passes structural and arithmetic checks', () => {
  assert.deepEqual(validateGreatScaleEvidence(envelope(), { now: Date.parse('2026-01-01T00:00:00Z') }), { valid: true, errors: [] });
});

test('unknown result fields remain explicitly null rather than fabricated', () => {
  const e = envelope();
  e.result = { chern_number: null, metric_area_budget: null, metric_area_excess: null, topological_saturation: null, great_scale_scalar: null };
  e.validation.domain_valid = false;
  e.validation.converged = false;
  assert.equal(validateGreatScaleEvidence(e).valid, true);
});

test('rejects missing or malformed source commit SHA', () => {
  const e = envelope();
  e.producer.commit = 'not-a-sha';
  const result = validateGreatScaleEvidence(e);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(x => x.includes('producer.commit')));
});

test('rejects a metric-area budget below the absolute Chern number', () => {
  const e = envelope();
  e.result.metric_area_budget = 0.9;
  const result = validateGreatScaleEvidence(e);
  assert.ok(result.errors.some(x => x.includes('A_Q < |C|')));
});

test('rejects inconsistent area excess, saturation, and scalar fields', () => {
  const e = envelope();
  e.result.metric_area_excess = 0.8;
  e.result.topological_saturation = 0.7;
  e.result.great_scale_scalar = 123;
  const result = validateGreatScaleEvidence(e);
  assert.ok(result.errors.some(x => x.includes('metric_area_excess inconsistent')));
  assert.ok(result.errors.some(x => x.includes('topological_saturation inconsistent')));
  assert.ok(result.errors.some(x => x.includes('great_scale_scalar inconsistent')));
});

test('zero area and zero Chern cannot be assigned a polarization-derived scalar', () => {
  const e = envelope();
  Object.assign(e.result, { chern_number: 0, metric_area_budget: 0, metric_area_excess: 0, topological_saturation: 0, great_scale_scalar: GREAT_SCALE_CONE + 0.25 });
  const result = validateGreatScaleEvidence(e);
  assert.ok(result.errors.some(x => x.includes('undefined polarization')));
});

test('signed Chern reversal preserves the scalar while reversing topology', () => {
  const negative = envelope();
  const positive = envelope();
  positive.result.chern_number = 1;
  assert.equal(validateGreatScaleEvidence(negative).valid, true);
  assert.equal(validateGreatScaleEvidence(positive).valid, true);
  assert.equal(negative.result.great_scale_scalar, positive.result.great_scale_scalar);
  assert.equal(negative.result.chern_number, -positive.result.chern_number);
});

test('normalized Great Scale scalar is invariant under common positive scaling of area and Chern data', () => {
  const base = envelope();
  const scaled = envelope();
  scaled.result.chern_number = -7;
  scaled.result.metric_area_budget = 14;
  scaled.result.metric_area_excess = 7;
  scaled.result.topological_saturation = 0.5;
  assert.equal(validateGreatScaleEvidence(base).valid, true);
  assert.equal(validateGreatScaleEvidence(scaled).valid, true);
  assert.ok(Math.abs(base.result.great_scale_scalar - scaled.result.great_scale_scalar) < 1e-12);
});

test('accepted status cannot contradict domain or convergence gates', () => {
  const e = acceptedEnvelope();
  e.validation.converged = false;
  const result = validateGreatScaleEvidence(e);
  assert.ok(result.errors.some(x => x.includes('accepted evidence requires domain_valid and converged')));
});

test('accepted evidence requires authorization, successful execution, digest, signature, and unexpired capability', () => {
  const e = acceptedEnvelope();
  assert.deepEqual(validateGreatScaleEvidence(e, { now: Date.parse('2026-01-01T00:00:00Z') }), { valid: true, errors: [] });

  const missingAuth = acceptedEnvelope();
  missingAuth.authorization.status = 'not_requested';
  assert.ok(validateGreatScaleEvidence(missingAuth, { now: Date.parse('2026-01-01T00:00:00Z') }).errors.some(x => x.includes('authorization.status authorized')));

  const failedRun = acceptedEnvelope();
  failedRun.execution.exit_code = 1;
  assert.ok(validateGreatScaleEvidence(failedRun, { now: Date.parse('2026-01-01T00:00:00Z') }).errors.some(x => x.includes('execution.exit_code 0')));

  const expired = acceptedEnvelope();
  expired.authorization.expires_at = '2025-01-01T00:00:00.000Z';
  assert.ok(validateGreatScaleEvidence(expired, { now: Date.parse('2026-01-01T00:00:00Z') }).errors.some(x => x.includes('not expired')));

  const unsigned = acceptedEnvelope();
  unsigned.integrity.signature_ref = null;
  assert.ok(validateGreatScaleEvidence(unsigned, { now: Date.parse('2026-01-01T00:00:00Z') }).errors.some(x => x.includes('signature reference')));
});


test('accepted evidence cannot hide unknown numerical outputs or convergence residuals', () => {
  const missingResult = acceptedEnvelope();
  missingResult.result.metric_area_budget = null;
  assert.ok(validateGreatScaleEvidence(missingResult, { now: Date.parse('2026-01-01T00:00:00Z') }).errors.some(x => x.includes('accepted evidence requires numeric result.metric_area_budget')));

  const missingResidual = acceptedEnvelope();
  missingResidual.validation.area_refinement_residual = null;
  assert.ok(validateGreatScaleEvidence(missingResidual, { now: Date.parse('2026-01-01T00:00:00Z') }).errors.some(x => x.includes('accepted evidence requires measured validation.area_refinement_residual')));
});

test('rejects malformed digest and invalid authorization timestamps', () => {
  const e = envelope();
  e.integrity.artifact_digest = 'not-a-digest';
  e.authorization.expires_at = 'tomorrow-ish';
  const result = validateGreatScaleEvidence(e);
  assert.ok(result.errors.some(x => x.includes('SHA-256 digest')));
  assert.ok(result.errors.some(x => x.includes('parseable timestamp')));
});

test('rejects unsupported schema version and non-finite residuals', () => {
  const e = envelope();
  e.schema = 'great-scale.evidence/v99';
  e.validation.entropy_residual = Number.NaN;
  const result = validateGreatScaleEvidence(e);
  assert.ok(result.errors.some(x => x.includes('unsupported schema')));
  assert.ok(result.errors.some(x => x.includes('entropy_residual')));
});

test('tolerance and clock input must be finite and valid', () => {
  assert.throws(() => validateGreatScaleEvidence(envelope(), { tolerance: -1 }), /tolerance/);
  assert.throws(() => validateGreatScaleEvidence(envelope(), { tolerance: Infinity }), /tolerance/);
  assert.throws(() => validateGreatScaleEvidence(envelope(), { now: Infinity }), /now/);
});

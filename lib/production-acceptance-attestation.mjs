import { createHash, createPublicKey, verify } from 'node:crypto';
import { coneCompliant } from './great-scale-residual.mjs';

export const PRODUCTION_ACCEPTANCE_SCHEMA = 'great-scale.production-acceptance/v1';
export const PRODUCTION_ACCEPTANCE_ISSUER = 'living-intermediate-control-plane-production-acceptance';
export const PRODUCTION_GATE_IDS = Object.freeze(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 30 * 1000;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const FULL_SHA = /^[a-f0-9]{40}$/i;

export function canonicalAcceptanceJson(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(item => canonicalAcceptanceJson(item)).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + canonicalAcceptanceJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hasExactKeys(value, expectedKeys) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...expectedKeys].sort().join('|');
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isBoundEvidenceUrl(candidate, runUrl) {
  try {
    const url = new URL(candidate);
    const run = new URL(runUrl);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.origin === run.origin &&
      (url.pathname === run.pathname || url.pathname.startsWith(run.pathname + '/'));
  } catch {
    return false;
  }
}

/**
 * Verify a proof-carrying G0-G6 production acceptance attestation.
 *
 * All trusted identity and policy inputs are deployment controlled. The artifact
 * cannot choose its own trust anchor, source repository/revision, required suite
 * set, or expected immutable artifact digest. A structurally valid signature is
 * not sufficient unless the execution and per-gate evidence bind to that policy.
 */
export function verifyProductionAcceptanceAttestation(attestation, {
  publicKeyPem = process.env.PRODUCTION_ACCEPTANCE_PUBLIC_KEY_PEM || '',
  keyId = process.env.PRODUCTION_ACCEPTANCE_KEY_ID || '',
  buildId = process.env.PRODUCTION_ACCEPTANCE_BUILD_ID || '',
  residualSourceId = process.env.PRODUCTION_ACCEPTANCE_RESIDUAL_SOURCE_ID || '',
  repository = process.env.PRODUCTION_ACCEPTANCE_REPOSITORY || '',
  commitSha = process.env.PRODUCTION_ACCEPTANCE_COMMIT_SHA || '',
  artifactDigest = process.env.PRODUCTION_ACCEPTANCE_ARTIFACT_DIGEST || '',
  requiredSuiteNames = (process.env.PRODUCTION_ACCEPTANCE_REQUIRED_SUITES || '')
    .split(',').map(name => name.trim()).filter(Boolean),
  environment = 'production',
  now = Date.now(),
} = {}) {
  const failures = [];
  const add = code => failures.push(code);
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    return { valid: false, failures: ['attestation_missing_or_not_object'] };
  }

  const topLevelFields = [
    'schema', 'issuer', 'keyId', 'environment', 'buildId',
    'generatedAt', 'expiresAt', 'source', 'execution', 'artifact',
    'suiteResults', 'gates', 'residual', 'digest', 'signature',
  ];
  if (!hasExactKeys(attestation, topLevelFields)) add('attestation_fields_not_exact');
  if (attestation.schema !== PRODUCTION_ACCEPTANCE_SCHEMA) add('schema_mismatch');
  if (attestation.issuer !== PRODUCTION_ACCEPTANCE_ISSUER) add('issuer_mismatch');
  if (!keyId || attestation.keyId !== keyId) add('key_id_mismatch');
  if (!buildId || attestation.buildId !== buildId) add('build_id_mismatch');
  if (attestation.environment !== environment || environment !== 'production') add('environment_mismatch');

  const source = attestation.source;
  const sourceFields = ['repository', 'commitSha'];
  if (!hasExactKeys(source, sourceFields)) {
    add('source_identity_missing_or_malformed');
  } else {
    if (typeof source.repository !== 'string' || !source.repository.trim()) add('source_repository_invalid');
    if (typeof source.commitSha !== 'string' || !FULL_SHA.test(source.commitSha)) add('source_commit_sha_invalid');
    if (!repository || source.repository !== repository) add('source_repository_mismatch');
    if (!commitSha || source.commitSha !== commitSha) add('source_commit_sha_mismatch');
  }

  const execution = attestation.execution;
  const executionFields = ['runId', 'runAttempt', 'runUrl', 'headSha', 'conclusion', 'completedAt'];
  if (!hasExactKeys(execution, executionFields)) {
    add('execution_proof_missing_or_malformed');
  } else {
    if (!Number.isSafeInteger(execution.runId) || execution.runId < 1) add('workflow_run_id_invalid');
    if (!Number.isSafeInteger(execution.runAttempt) || execution.runAttempt < 1) add('workflow_run_attempt_invalid');
    if (execution.conclusion !== 'success') add('workflow_conclusion_not_success');
    if (typeof execution.headSha !== 'string' || !FULL_SHA.test(execution.headSha)) add('workflow_head_sha_invalid');
    if (source && execution.headSha !== source.commitSha) add('workflow_head_source_sha_mismatch');
    if (!validTimestamp(execution.completedAt)) {
      add('workflow_completed_at_invalid');
    } else {
      const completedAt = Date.parse(execution.completedAt);
      if (completedAt > now + MAX_CLOCK_SKEW_MS) add('workflow_completed_at_in_future');
      if (validTimestamp(attestation.generatedAt) &&
          completedAt > Date.parse(attestation.generatedAt) + MAX_CLOCK_SKEW_MS) {
        add('workflow_completed_after_attestation_generated');
      }
    }
    let expectedRunUrl = '';
    if (source && typeof source.repository === 'string' &&
        Number.isSafeInteger(execution.runId) && execution.runId > 0) {
      expectedRunUrl = 'https://github.com/' + source.repository + '/actions/runs/' + execution.runId;
    }
    if (!expectedRunUrl || execution.runUrl !== expectedRunUrl) add('workflow_run_url_not_bound_to_source_and_run');
    try {
      const url = new URL(execution.runUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'github.com' ||
          url.username || url.password || url.search || url.hash) {
        add('workflow_run_url_invalid');
      }
    } catch {
      add('workflow_run_url_invalid');
    }
  }

  const artifact = attestation.artifact;
  if (!hasExactKeys(artifact, ['name', 'digest'])) {
    add('artifact_identity_missing_or_malformed');
  } else {
    if (typeof artifact.name !== 'string' || !artifact.name.trim()) add('artifact_name_invalid');
    if (typeof artifact.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest)) add('artifact_digest_invalid');
    if (!artifactDigest || artifact.digest !== artifactDigest) add('artifact_digest_mismatch');
  }

  const required = Array.isArray(requiredSuiteNames)
    ? requiredSuiteNames.filter(name => typeof name === 'string' && name.trim()).map(name => name.trim())
    : [];
  if (required.length === 0 || new Set(required).size !== required.length) {
    add('required_suite_policy_missing_or_invalid');
  }
  const suiteResults = Array.isArray(attestation.suiteResults) ? attestation.suiteResults : [];
  const suiteNames = suiteResults.map(suite => suite?.name);
  if (suiteResults.length !== required.length ||
      new Set(suiteNames).size !== suiteResults.length ||
      [...suiteNames].sort().join('|') !== [...required].sort().join('|')) {
    add('required_suite_set_mismatch');
  }
  const suiteByName = new Map();
  for (const suite of suiteResults) {
    if (!hasExactKeys(suite, ['name', 'conclusion', 'headSha', 'runId', 'runAttempt', 'evidenceUrl', 'evidenceDigest'])) {
      add('suite_result_fields_invalid');
      continue;
    }
    if (typeof suite.name !== 'string' || !suite.name.trim()) add('suite_name_invalid');
    if (suite.conclusion !== 'success') add('required_suite_not_successful');
    if (!source || suite.headSha !== source.commitSha) add('suite_head_sha_mismatch');
    if (!execution || suite.runId !== execution.runId || suite.runAttempt !== execution.runAttempt) add('suite_run_identity_mismatch');
    if (!execution || !isBoundEvidenceUrl(suite.evidenceUrl, execution.runUrl)) add('suite_evidence_url_not_bound_to_run');
    if (typeof suite.evidenceDigest !== 'string' || !SHA256_HEX.test(suite.evidenceDigest)) add('suite_evidence_digest_invalid');
    if (typeof suite.name === 'string') suiteByName.set(suite.name, suite);
  }

  const gates = Array.isArray(attestation.gates) ? attestation.gates : [];
  const gateIds = gates.map(gate => gate?.id);
  if (gates.length !== PRODUCTION_GATE_IDS.length ||
      new Set(gateIds).size !== PRODUCTION_GATE_IDS.length ||
      !PRODUCTION_GATE_IDS.every(id => gateIds.includes(id))) {
    add('production_gate_set_incomplete_or_duplicated');
  }
  for (const gate of gates) {
    if (!hasExactKeys(gate, ['id', 'status', 'evidence'])) {
      add('production_gate_fields_invalid');
      continue;
    }
    if (!PRODUCTION_GATE_IDS.includes(gate.id) || gate.status !== 'PASS') add('production_gate_not_passing');
    if (!Array.isArray(gate.evidence) || gate.evidence.length === 0) {
      add('production_gate_evidence_missing');
      continue;
    }
    for (const evidence of gate.evidence) {
      if (!hasExactKeys(evidence, ['suiteName', 'evidenceDigest', 'observedAt'])) {
        add('gate_evidence_fields_invalid');
        continue;
      }
      const suite = suiteByName.get(evidence.suiteName);
      if (!suite) {
        add('gate_evidence_references_unknown_suite');
      } else if (evidence.evidenceDigest !== suite.evidenceDigest) {
        add('gate_evidence_digest_mismatch');
      }
      if (!validTimestamp(evidence.observedAt)) {
        add('gate_evidence_timestamp_invalid');
      } else {
        const observedAt = Date.parse(evidence.observedAt);
        if (observedAt > now + MAX_CLOCK_SKEW_MS) add('gate_evidence_timestamp_in_future');
        if (execution && validTimestamp(execution.completedAt) &&
            observedAt > Date.parse(execution.completedAt) + MAX_CLOCK_SKEW_MS) {
          add('gate_evidence_observed_after_run_completion');
        }
      }
    }
  }

  // A default S=0 is not a measurement. The finite, fresh, source- and build-bound
  // residual is signed with the rest of the production acceptance proof.
  const residual = attestation.residual;
  if (!hasExactKeys(residual, ['schema', 'sourceId', 'buildId', 'measuredAt', 'S'])) {
    add('residual_measurement_missing_or_malformed');
  } else {
    const measuredAt = Date.parse(residual.measuredAt);
    if (residual.schema !== 'great-scale.residual-attestation/v1') add('residual_schema_mismatch');
    if (!residualSourceId || residual.sourceId !== residualSourceId) add('residual_source_id_mismatch');
    if (residual.buildId !== buildId || residual.buildId !== attestation.buildId) add('residual_build_id_mismatch');
    if (typeof residual.S !== 'number' || !Number.isFinite(residual.S)) add('residual_value_invalid');
    else if (!coneCompliant(residual.S)) add('residual_cone_violation');
    if (!Number.isFinite(measuredAt)) add('residual_timestamp_invalid');
    else {
      if (measuredAt > now + MAX_CLOCK_SKEW_MS) add('residual_measured_at_in_future');
      if (now - measuredAt > MAX_AGE_MS) add('residual_measurement_stale');
    }
  }

  const generated = Date.parse(attestation.generatedAt);
  const expires = Date.parse(attestation.expiresAt);
  if (!Number.isFinite(generated) || !Number.isFinite(expires)) {
    add('timestamps_invalid');
  } else {
    if (generated > now + MAX_CLOCK_SKEW_MS) add('generated_at_in_future');
    if (now - generated > MAX_AGE_MS) add('attestation_stale');
    if (expires <= now) add('attestation_expired');
    if (expires <= generated || expires - generated > MAX_AGE_MS) add('attestation_lifetime_invalid');
  }

  const { digest, signature, ...body } = attestation;
  const payload = canonicalAcceptanceJson(body);
  const expectedDigest = sha256Hex(payload);
  if (digest !== expectedDigest) add('digest_mismatch');

  if (!publicKeyPem || !keyId || !buildId || !residualSourceId ||
      !repository || !commitSha || !artifactDigest || required.length === 0) {
    add('trusted_verification_configuration_missing');
  } else if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) {
    add('signature_malformed');
  } else if (digest === expectedDigest) {
    try {
      const key = createPublicKey(publicKeyPem);
      const raw = Buffer.from(signature, 'base64');
      if (key.asymmetricKeyType !== 'ed25519') add('public_key_type_invalid');
      else if (raw.toString('base64') !== signature ||
        !verify(null, Buffer.from(payload, 'utf8'), key, raw)) add('signature_invalid');
    } catch {
      add('public_key_or_signature_invalid');
    }
  }

  return {
    valid: failures.length === 0,
    failures,
    schema: PRODUCTION_ACCEPTANCE_SCHEMA,
    residual: failures.length === 0 ? { ...attestation.residual } : null,
    source: failures.length === 0 ? { ...attestation.source } : null,
    execution: failures.length === 0 ? { ...attestation.execution } : null,
    artifact: failures.length === 0 ? { ...attestation.artifact } : null,
  };
}

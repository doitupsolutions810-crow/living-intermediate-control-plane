import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  CONTROL_PLANE_REPOSITORY,
  GREAT_SCALE_G6_RECEIPT_ISSUER,
  GREAT_SCALE_G6_RECEIPT_SCHEMA,
  GREAT_SCALE_G6_RECEIPT_SCHEMA_BLOB_SHA,
  GREAT_SCALE_REPOSITORY,
  canonicalG6ReceiptJson,
  verifyGreatScaleG6ResidualReceipt,
} from '../lib/g6-residual-receipt.mjs';

const receiptKeys = generateKeyPairSync('ed25519');
const certificateKeys = generateKeyPairSync('ed25519');
const receiptPublicKeyPem = receiptKeys.publicKey.export({ type: 'spki', format: 'pem' });
const receiptPrivateKeyPem = receiptKeys.privateKey;
const certificatePublicKeyPem = certificateKeys.publicKey.export({ type: 'spki', format: 'pem' });
const certificatePrivateKeyPem = certificateKeys.privateKey;

const NOW = Date.now();
const sourceCommitSha = 'a'.repeat(40);
const targetCommitSha = 'b'.repeat(40);
const modelInputDigest = 'd'.repeat(64);
const modelArtifactDigest = 'sha256:' + 'e'.repeat(64);
const targetArtifactDigest = 'sha256:' + 'f'.repeat(64);
const proofUrl = 'https://evidence.example/numerical-certificates/proof.json';
const numericalVerifierId = 'trusted-interval-verifier-v1';
const receiptKeyId = 'great-scale-receipt-key-v1';
const certificateKeyId = 'great-scale-numerical-certificate-key-v1';
const targetBuildId = 'licp-release-17';
const measurementBuildId = 'great-scale-model-build-17';

const expected = {
  sourceCommitSha,
  measurementBuildId,
  modelArtifactName: 'great-scale-model-build-17.tar.zst',
  modelArtifactDigest,
  modelVersion: 'qgt-model-2.4.0',
  modelParameters: { m: -1, gridSize: 40, maxRefinements: 3 },
  modelInputDigest,
  runId: 12345,
  runAttempt: 2,
  targetBuildId,
  targetRepository: CONTROL_PLANE_REPOSITORY,
  targetCommitSha,
  targetArtifactName: 'living-intermediate-control-plane-release.tar.zst',
  targetArtifactDigest,
  numericalVerifierId,
  residualSourceId: GREAT_SCALE_G6_RECEIPT_ISSUER,
  g6ReceiptSchemaBlobSha: GREAT_SCALE_G6_RECEIPT_SCHEMA_BLOB_SHA,
};

const time = offsetMs => new Date(NOW + offsetMs).toISOString();
const sha256 = value => createHash('sha256').update(value).digest('hex');

const proofBytes = Buffer.from(JSON.stringify({
  certificate: 'independent numerical enclosure proof fixture',
  sourceCommitSha,
  modelInputDigest,
  method: 'interval-enclosure-v1',
}), 'utf8');

function signCertificate(certificate) {
  const unsigned = { ...certificate };
  delete unsigned.certificateSignature;
  return {
    ...certificate,
    certificateSignature: sign(
      null,
      Buffer.from(canonicalG6ReceiptJson(unsigned), 'utf8'),
      certificatePrivateKeyPem,
    ).toString('base64'),
  };
}

function signReceipt(receipt) {
  const unsigned = { ...receipt };
  delete unsigned.digest;
  delete unsigned.signature;
  const canonical = canonicalG6ReceiptJson(unsigned);
  return {
    ...receipt,
    digest: sha256(Buffer.from(canonical, 'utf8')),
    signature: sign(
      null,
      Buffer.from(canonical, 'utf8'),
      receiptPrivateKeyPem,
    ).toString('base64'),
  };
}

function makeFixture({
  receiptChanges = {},
  measurementChanges = {},
  certificateChanges = {},
  proof = proofBytes,
  corruptReceiptSignature = false,
  corruptCertificateSignature = false,
} = {}) {
  const saturation = 0.6;
  const STopological = (1 - saturation * saturation) / 4;
  const phi = (1 + Math.sqrt(5)) / 2;
  const cone = (phi - 1) * (phi - 1);
  const tolerance = 0.01;

  const measurement = {
    chernNumber: -1,
    rawChernNumber: -1,
    chernIntegerResidual: 0.001,
    integratedCurvature: -2 * Math.PI,
    absoluteCurvatureBudget: 5,
    positiveCurvatureBudget: 3,
    negativeCurvatureBudget: 2,
    curvatureCancellationBudget: 1,
    metricAreaBudget: 4,
    topologicalFloor: 1,
    metricAreaExcess: 3,
    topologicalSaturationRaw: saturation,
    topologicalSaturation: saturation,
    signedTopologicalPolarization: -saturation,
    STopological,
    psiTopological: cone + STopological,
    acceptedPsiTopological: cone + STopological,
    curvatureOrientationEntropyResidual: 0.001,
    curvatureChernResidual: 0.001,
    curvatureCancellationIdentityResidual: 0.001,
    curvatureOrientationVarianceResidual: 0.001,
    gridAlignmentCurvatureDiscrepancy: 0.001,
    gridAlignmentAreaDiscrepancy: 0.001,
    quadratureTolerance: tolerance,
    quadratureConverged: true,
    topologicalMappingValid: true,
    refinementCount: 3,
    refinedGridSize: 320,
    curvatureErrorEstimateWithSafetyFactor: 0.002,
    metricAreaErrorEstimateWithSafetyFactor: 0.002,
    errorEstimatesFinite: true,
    errorBoundMethod: 'richardson-asymptotic-estimate-only',
    ...measurementChanges,
  };

  const certificate = signCertificate({
    method: 'interval-enclosure-v1',
    verifierId: numericalVerifierId,
    sourceCommitSha,
    modelInputDigest,
    curvatureErrorUpperBound: 0.003,
    metricAreaErrorUpperBound: 0.004,
    evidenceUrl: proofUrl,
    proofDigest: sha256(proof),
    verified: true,
    certificateKeyId,
    certificateSignature: '',
    generatedAt: time(-40_000),
    expiresAt: time(90_000),
    ...certificateChanges,
    certificateSignature: '',
  });

  if (corruptCertificateSignature) {
    certificate.certificateSignature = Buffer.alloc(64, 7).toString('base64');
  }

  const base = {
    schema: GREAT_SCALE_G6_RECEIPT_SCHEMA,
    issuer: GREAT_SCALE_G6_RECEIPT_ISSUER,
    keyId: receiptKeyId,
    environment: 'production',
    generatedAt: time(-30_000),
    expiresAt: time(60_000),
    source: {
      repository: GREAT_SCALE_REPOSITORY,
      commitSha: sourceCommitSha,
      ...receiptChanges.source,
    },
    execution: {
      runId: 12345,
      runAttempt: 2,
      runUrl: 'https://github.com/' + GREAT_SCALE_REPOSITORY + '/actions/runs/12345',
      headSha: sourceCommitSha,
      conclusion: 'success',
      startedAt: time(-90_000),
      completedAt: time(-60_000),
      ...receiptChanges.execution,
    },
    artifact: {
      name: expected.modelArtifactName,
      digest: modelArtifactDigest,
      ...receiptChanges.artifact,
    },
    model: {
      id: 'qi-wu-zhang-two-band',
      version: expected.modelVersion,
      parameters: { ...expected.modelParameters, ...receiptChanges.model?.parameters },
      inputDigest: modelInputDigest,
      ...receiptChanges.model,
      parameters: { ...expected.modelParameters, ...receiptChanges.model?.parameters },
    },
    measurement,
    digest: '',
    signature: '',
    measuredAt: time(-55_000),
    canonicalization: 'great-scale.canonical-json/v1',
    signatureAlgorithm: 'Ed25519',
    measurementBuildId,
    targetBuildId,
    target: {
      repository: CONTROL_PLANE_REPOSITORY,
      commitSha: targetCommitSha,
      ...receiptChanges.target,
    },
    targetArtifact: {
      name: expected.targetArtifactName,
      digest: targetArtifactDigest,
      ...receiptChanges.targetArtifact,
    },
    numericalCertification: certificate,
    ...receiptChanges,
    source: { repository: GREAT_SCALE_REPOSITORY, commitSha: sourceCommitSha, ...receiptChanges.source },
    execution: {
      runId: 12345,
      runAttempt: 2,
      runUrl: 'https://github.com/' + GREAT_SCALE_REPOSITORY + '/actions/runs/12345',
      headSha: sourceCommitSha,
      conclusion: 'success',
      startedAt: time(-90_000),
      completedAt: time(-60_000),
      ...receiptChanges.execution,
    },
    artifact: {
      name: expected.modelArtifactName,
      digest: modelArtifactDigest,
      ...receiptChanges.artifact,
    },
    model: {
      id: 'qi-wu-zhang-two-band',
      version: expected.modelVersion,
      parameters: { ...expected.modelParameters, ...receiptChanges.model?.parameters },
      inputDigest: modelInputDigest,
      ...receiptChanges.model,
      parameters: { ...expected.modelParameters, ...receiptChanges.model?.parameters },
    },
    measurement,
    target: {
      repository: CONTROL_PLANE_REPOSITORY,
      commitSha: targetCommitSha,
      ...receiptChanges.target,
    },
    targetArtifact: {
      name: expected.targetArtifactName,
      digest: targetArtifactDigest,
      ...receiptChanges.targetArtifact,
    },
    numericalCertification: certificate,
  };

  let receipt = signReceipt(base);
  if (corruptReceiptSignature) receipt.signature = Buffer.alloc(64, 3).toString('base64');
  return {
    receipt,
    proofEvidence: { url: certificate.evidenceUrl, bytes: proof },
    options: {
      expected,
      receiptPublicKeyPem,
      receiptKeyId,
      numericalCertificatePublicKeyPem: certificatePublicKeyPem,
      numericalCertificateKeyId: certificateKeyId,
      proofEvidence: { url: certificate.evidenceUrl, bytes: proof },
      now: NOW,
      maxAgeMs: 300_000,
      maxClockSkewMs: 30_000,
    },
  };
}

test('valid, dual-signed G6 receipt maps to the compact build-bound residual', () => {
  const fixture = makeFixture();
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, true, result.failures.join(','));
  assert.deepEqual(result.residual, {
    schema: 'great-scale.residual-attestation/v1',
    sourceId: GREAT_SCALE_G6_RECEIPT_ISSUER,
    buildId: targetBuildId,
    measuredAt: fixture.receipt.measuredAt,
    S: fixture.receipt.measurement.STopological,
  });
  assert.equal(result.verified.sourceCommitSha, sourceCommitSha);
  assert.equal(result.verified.targetCommitSha, targetCommitSha);
  assert.equal(result.verified.measurementBuildId, measurementBuildId);
  assert.equal(result.verified.targetBuildId, targetBuildId);
});

test('missing deployment pins and independent trust anchors fail closed', () => {
  const fixture = makeFixture();
  const missing = verifyGreatScaleG6ResidualReceipt(fixture.receipt);
  assert.equal(missing.valid, false);
  assert.ok(missing.failures.includes('g6_expected_deployment_pins_missing'));

  const sameKey = verifyGreatScaleG6ResidualReceipt(fixture.receipt, {
    ...fixture.options,
    numericalCertificatePublicKeyPem: receiptPublicKeyPem,
    numericalCertificateKeyId: 'a-different-id-but-the-same-key',
  });
  assert.equal(sameKey.valid, false);
  assert.ok(sameKey.failures.includes('g6_outer_and_numerical_certificate_key_material_must_be_distinct'));
});

test('source commit and workflow head must match the independently pinned revision', () => {
  const fixture = makeFixture({
    receiptChanges: {
      source: { commitSha: 'c'.repeat(40) },
      execution: { headSha: 'c'.repeat(40) },
    },
  });
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_receipt_source_commit_mismatch'));
});

test('target revision, target build, and target artifact stay independently pinned', () => {
  const fixture = makeFixture({
    receiptChanges: {
      target: { commitSha: 'c'.repeat(40) },
      targetBuildId: 'other-target-build',
      targetArtifact: { digest: 'sha256:' + 'c'.repeat(64) },
    },
  });
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_receipt_target_commit_mismatch'));
  assert.ok(result.failures.includes('g6_receipt_target_build_id_mismatch'));
  assert.ok(result.failures.includes('g6_receipt_target_artifact_digest_mismatch'));
});

test('outer digest/signature tampering is rejected', () => {
  const fixture = makeFixture({ corruptReceiptSignature: true });
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_receipt_signature_verification_failed'));
});

test('numerical certificate needs its own valid Ed25519 signature', () => {
  const fixture = makeFixture({ corruptCertificateSignature: true });
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_numerical_certificate_signature_verification_failed'));
});

test('the certificate proof digest must match the exact fetched bytes at its declared URL', () => {
  const fixture = makeFixture();
  fixture.options.proofEvidence = {
    url: fixture.receipt.numericalCertification.evidenceUrl,
    bytes: Buffer.from('different proof bytes', 'utf8'),
  };
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_numerical_certificate_proof_digest_mismatch'));
});

test('signed upper bounds above the model tolerance do not qualify for G6', () => {
  const fixture = makeFixture({
    certificateChanges: {
      curvatureErrorUpperBound: 0.02,
    },
  });
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_numerical_certificate_error_bound_exceeds_tolerance'));
});

test('empirical convergence flags do not replace the independent certificate', () => {
  const fixture = makeFixture({
    measurementChanges: { STopological: 0.3 },
  });
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_measurement_topological_residual_invalid'));
});

test('expired numerical certificates and receipts are rejected', () => {
  const fixture = makeFixture({
    certificateChanges: {
      generatedAt: time(-600_000),
      expiresAt: time(-300_000),
    },
  });
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_numerical_certificate_expired'));
  assert.ok(result.failures.includes('g6_receipt_outlives_numerical_certificate'));
});

test('unexpected measurement fields fail exact-shape validation', () => {
  const fixture = makeFixture({
    measurementChanges: { injectedAuthority: true },
  });
  const result = verifyGreatScaleG6ResidualReceipt(fixture.receipt, fixture.options);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('g6_receipt_measurement_shape_invalid'));
});

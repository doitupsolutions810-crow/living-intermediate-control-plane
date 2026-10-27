import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';

export const GREAT_SCALE_G6_RECEIPT_SCHEMA = 'great-scale.g6-residual-measurement/v1';
export const GREAT_SCALE_G6_RECEIPT_ISSUER = 'great-scale-g6-residual-measurer';
export const GREAT_SCALE_REPOSITORY = 'doitupsolutions810-crow/great-scale';
export const CONTROL_PLANE_REPOSITORY = 'doitupsolutions810-crow/living-intermediate-control-plane';
export const GREAT_SCALE_G6_RECEIPT_SCHEMA_BLOB_SHA = '63f790b4bd6799efc22c11c35d2dbec3b126ad48';

const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 30 * 1000;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const FULL_SHA = /^[a-f0-9]{40}$/;
const ARTIFACT_DIGEST = /^sha256:[a-f0-9]{64}$/;
const BASE64_ED25519 = /^[A-Za-z0-9+/]{86}==$/;
const RFC3339_TIMESTAMP = /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/;

const RECEIPT_KEYS = [
  'schema', 'issuer', 'keyId', 'environment', 'generatedAt', 'expiresAt',
  'source', 'execution', 'artifact', 'model', 'measurement', 'digest', 'signature',
  'measuredAt', 'canonicalization', 'signatureAlgorithm', 'measurementBuildId',
  'targetBuildId', 'target', 'targetArtifact', 'numericalCertification',
];
const SOURCE_KEYS = ['repository', 'commitSha'];
const EXECUTION_KEYS = [
  'runId', 'runAttempt', 'runUrl', 'headSha', 'conclusion', 'startedAt', 'completedAt',
];
const ARTIFACT_KEYS = ['name', 'digest'];
const MODEL_KEYS = ['id', 'version', 'parameters', 'inputDigest'];
const MODEL_PARAMETER_KEYS = ['m', 'gridSize', 'maxRefinements'];
const TARGET_KEYS = ['repository', 'commitSha'];
const NUMERICAL_CERTIFICATION_KEYS = [
  'method', 'verifierId', 'sourceCommitSha', 'modelInputDigest',
  'curvatureErrorUpperBound', 'metricAreaErrorUpperBound', 'evidenceUrl',
  'proofDigest', 'verified', 'certificateKeyId', 'certificateSignature',
  'generatedAt', 'expiresAt', 'measurementDigest',
];
const MEASUREMENT_KEYS = [
  'chernNumber', 'rawChernNumber', 'chernIntegerResidual', 'integratedCurvature',
  'absoluteCurvatureBudget', 'positiveCurvatureBudget', 'negativeCurvatureBudget',
  'curvatureCancellationBudget', 'metricAreaBudget', 'topologicalFloor', 'metricAreaExcess',
  'topologicalSaturationRaw', 'topologicalSaturation', 'signedTopologicalPolarization',
  'STopological', 'psiTopological', 'acceptedPsiTopological',
  'curvatureOrientationEntropyResidual', 'curvatureChernResidual',
  'curvatureCancellationIdentityResidual', 'curvatureOrientationVarianceResidual',
  'gridAlignmentCurvatureDiscrepancy', 'gridAlignmentAreaDiscrepancy',
  'quadratureTolerance', 'quadratureConverged', 'topologicalMappingValid',
  'refinementCount', 'refinedGridSize', 'curvatureErrorEstimateWithSafetyFactor',
  'metricAreaErrorEstimateWithSafetyFactor', 'errorEstimatesFinite', 'errorBoundMethod',
];
const BOOLEAN_MEASUREMENT_KEYS = new Set([
  'quadratureConverged', 'topologicalMappingValid', 'errorEstimatesFinite',
]);
const TOLERANCE_RESIDUAL_KEYS = [
  'chernIntegerResidual', 'curvatureOrientationEntropyResidual', 'curvatureChernResidual',
  'curvatureCancellationIdentityResidual', 'curvatureOrientationVarianceResidual',
  'gridAlignmentCurvatureDiscrepancy', 'gridAlignmentAreaDiscrepancy',
];

const NON_NEGATIVE_MEASUREMENT_KEYS = new Set([
  'chernIntegerResidual', 'absoluteCurvatureBudget', 'positiveCurvatureBudget',
  'negativeCurvatureBudget', 'curvatureCancellationBudget', 'topologicalFloor',
  'curvatureOrientationEntropyResidual', 'curvatureChernResidual',
  'curvatureCancellationIdentityResidual', 'curvatureOrientationVarianceResidual',
  'gridAlignmentCurvatureDiscrepancy', 'gridAlignmentAreaDiscrepancy',
  'curvatureErrorEstimateWithSafetyFactor', 'metricAreaErrorEstimateWithSafetyFactor',
]);

function binaryEntropyNats(probability) {
  if (probability <= 0 || probability >= 1) return 0;
  return -probability * Math.log(probability) -
    (1 - probability) * Math.log1p(-probability);
}

export function canonicalG6ReceiptJson(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(item => canonicalG6ReceiptJson(item)).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + canonicalG6ReceiptJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isExactObject(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseStrictTimestamp(value) {
  if (typeof value !== 'string' || !RFC3339_TIMESTAMP.test(value)) return NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return NaN;
  const datePart = value.slice(0, 10);
  const midnight = Date.parse(datePart + 'T00:00:00Z');
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== datePart) {
    return NaN;
  }
  return parsed;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.hash;
  } catch {
    return false;
  }
}

function exactSha(value) {
  return typeof value === 'string' && FULL_SHA.test(value);
}

function exactDigest(value) {
  return typeof value === 'string' && SHA256_HEX.test(value);
}

function validArtifactDigest(value) {
  return typeof value === 'string' && ARTIFACT_DIGEST.test(value);
}

function safePositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function approximatelyEqual(left, right, tolerance) {
  return Number.isFinite(left) && Number.isFinite(right) &&
    Math.abs(left - right) <= tolerance;
}

function missingTrustConfiguration({
  expected, receiptPublicKeyPem, receiptKeyId,
  numericalCertificatePublicKeyPem, numericalCertificateKeyId,
  proofEvidence,
}) {
  const failures = [];
  const requiredExpected = [
    'sourceCommitSha', 'measurementBuildId', 'modelArtifactName', 'modelArtifactDigest',
    'modelVersion', 'modelParameters', 'modelInputDigest', 'runId', 'runAttempt',
    'targetBuildId', 'targetRepository', 'targetCommitSha', 'targetArtifactName',
    'targetArtifactDigest', 'numericalVerifierId', 'numericalCertificateEvidenceOrigin', 'residualSourceId', 'g6ReceiptSchemaBlobSha',
  ];
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    failures.push('g6_expected_deployment_pins_missing');
    return failures;
  }
  const missingPinCountBefore = failures.length;
  for (const key of requiredExpected) {
    if (expected[key] === undefined || expected[key] === null ||
        (typeof expected[key] === 'string' && !expected[key].trim())) {
      failures.push('g6_expected_pin_missing_' + key);
    }
  }
  if (failures.length > missingPinCountBefore) {
    failures.push('g6_expected_deployment_pins_missing');
  }
  if (!hasText(receiptPublicKeyPem)) failures.push('g6_receipt_public_key_missing');
  if (!hasText(receiptKeyId)) failures.push('g6_receipt_key_id_missing');
  if (!hasText(numericalCertificatePublicKeyPem)) failures.push('g6_numerical_certificate_public_key_missing');
  if (!hasText(numericalCertificateKeyId)) failures.push('g6_numerical_certificate_key_id_missing');
  if (receiptKeyId && numericalCertificateKeyId && receiptKeyId === numericalCertificateKeyId) {
    failures.push('g6_receipt_and_numerical_certificate_key_ids_must_be_distinct');
  }
  if (!proofEvidence || typeof proofEvidence !== 'object' ||
      typeof proofEvidence.url !== 'string' ||
      !(proofEvidence.bytes instanceof Uint8Array)) {
    failures.push('g6_numerical_certificate_proof_bytes_not_supplied');
  }
  if (expected && expected.modelParameters &&
      !isExactObject(expected.modelParameters, MODEL_PARAMETER_KEYS)) {
    failures.push('g6_expected_model_parameters_invalid');
  }
  if (expected && expected.modelParameters &&
      (!Number.isFinite(expected.modelParameters.m) ||
       !Number.isSafeInteger(expected.modelParameters.gridSize) ||
       !Number.isSafeInteger(expected.modelParameters.maxRefinements))) {
    failures.push('g6_expected_model_parameters_invalid');
  }
  if (expected && expected.modelParameters &&
      ([-2, 0, 2].includes(expected.modelParameters.m) ||
       expected.modelParameters.gridSize < 4 || expected.modelParameters.gridSize > 4096 ||
       expected.modelParameters.maxRefinements < 1 || expected.modelParameters.maxRefinements > 5)) {
    failures.push('g6_expected_model_parameters_out_of_domain');
  }
  if (expected && expected.sourceCommitSha && !exactSha(expected.sourceCommitSha)) {
    failures.push('g6_expected_source_commit_invalid');
  }
  if (expected && expected.targetCommitSha && !exactSha(expected.targetCommitSha)) {
    failures.push('g6_expected_target_commit_invalid');
  }
  if (expected && expected.modelInputDigest && !exactDigest(expected.modelInputDigest)) {
    failures.push('g6_expected_model_input_digest_invalid');
  }
  if (expected && expected.modelArtifactDigest && !validArtifactDigest(expected.modelArtifactDigest)) {
    failures.push('g6_expected_model_artifact_digest_invalid');
  }
  if (expected && expected.targetArtifactDigest && !validArtifactDigest(expected.targetArtifactDigest)) {
    failures.push('g6_expected_target_artifact_digest_invalid');
  }
  if (expected && hasText(expected.numericalCertificateEvidenceOrigin)) {
    try {
      const origin = new URL(expected.numericalCertificateEvidenceOrigin);
      if (origin.protocol !== 'https:' ||
          origin.origin !== expected.numericalCertificateEvidenceOrigin ||
          origin.pathname !== '/' || origin.search || origin.hash ||
          origin.username || origin.password) {
        failures.push('g6_expected_numerical_certificate_evidence_origin_invalid');
      }
    } catch {
      failures.push('g6_expected_numerical_certificate_evidence_origin_invalid');
    }
  } else {
    failures.push('g6_expected_pin_missing_numericalCertificateEvidenceOrigin');
  }
  if (expected && expected.measurementBuildId && !/^[A-Za-z0-9._:-]+$/.test(expected.measurementBuildId)) {
    failures.push('g6_expected_measurement_build_id_invalid');
  }
  if (expected && expected.targetBuildId && !/^[A-Za-z0-9._:-]+$/.test(expected.targetBuildId)) {
    failures.push('g6_expected_target_build_id_invalid');
  }
  if (expected && expected.runId !== undefined && !safePositiveInteger(expected.runId)) {
    failures.push('g6_expected_run_id_invalid');
  }
  if (expected && expected.runAttempt !== undefined && !safePositiveInteger(expected.runAttempt)) {
    failures.push('g6_expected_run_attempt_invalid');
  }
  if (expected && expected.targetRepository !== CONTROL_PLANE_REPOSITORY) {
    failures.push('g6_expected_target_repository_invalid');
  }
  if (expected && expected.residualSourceId !== GREAT_SCALE_G6_RECEIPT_ISSUER) {
    failures.push('g6_expected_residual_source_id_must_match_pinned_issuer');
  }
  if (expected && expected.g6ReceiptSchemaBlobSha !== GREAT_SCALE_G6_RECEIPT_SCHEMA_BLOB_SHA) {
    failures.push('g6_expected_receipt_schema_blob_sha_mismatch');
  }
  return failures;
}

/**
 * Validate a signed Great Scale G6 measurement receipt and map it to the compact
 * residual block required by the Control Plane G0-G6 acceptance contract.
 *
 * Trust material and expected source/target identities must be deployment-pinned.
 * proofEvidence.bytes must be the raw bytes fetched by the trusted producer from
 * proofEvidence.url; this function checks URL equality and the signed proof digest
 * but does not itself perform the network fetch or authenticate GitHub Actions.
 * This module is a verifier/mapping building block, not a production producer.
 */
export function verifyGreatScaleG6ResidualReceipt(receipt, {
  expected = {},
  receiptPublicKeyPem = '',
  receiptKeyId = '',
  numericalCertificatePublicKeyPem = '',
  numericalCertificateKeyId = '',
  proofEvidence = null,
  now = Date.now(),
  maxAgeMs = MAX_AGE_MS,
  maxClockSkewMs = MAX_CLOCK_SKEW_MS,
} = {}) {
  const failures = [];
  const add = code => failures.push(code);
  const configFailures = missingTrustConfiguration({
    expected, receiptPublicKeyPem, receiptKeyId,
    numericalCertificatePublicKeyPem, numericalCertificateKeyId, proofEvidence,
  });
  failures.push(...configFailures);
  if (failures.length) return { valid: false, failures };
  try {
    const receiptKey = createPublicKey(receiptPublicKeyPem);
    const certificateKey = createPublicKey(numericalCertificatePublicKeyPem);
    if (receiptKey.asymmetricKeyType !== 'ed25519' ||
        certificateKey.asymmetricKeyType !== 'ed25519') {
      add('g6_pinned_keys_must_be_ed25519');
    } else {
      const receiptKeyBytes = receiptKey.export({ type: 'spki', format: 'der' });
      const certificateKeyBytes = certificateKey.export({ type: 'spki', format: 'der' });
      if (Buffer.from(receiptKeyBytes).equals(Buffer.from(certificateKeyBytes))) {
        add('g6_outer_and_numerical_certificate_key_material_must_be_distinct');
      }
    }
  } catch {
    add('g6_pinned_public_key_invalid');
  }
  if (failures.length) return { valid: false, failures };

  if (!Number.isFinite(now)) {
    return { valid: false, failures: ['g6_verification_clock_invalid'] };
  }
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1000 || maxAgeMs > 15 * 60 * 1000 ||
      !Number.isSafeInteger(maxClockSkewMs) || maxClockSkewMs < 0 || maxClockSkewMs > 2 * 60 * 1000) {
    return { valid: false, failures: ['g6_verification_time_policy_invalid'] };
  }
  if (!receipt || !isExactObject(receipt, RECEIPT_KEYS)) {
    return { valid: false, failures: ['g6_receipt_shape_invalid'] };
  }

  if (receipt.schema !== GREAT_SCALE_G6_RECEIPT_SCHEMA) add('g6_receipt_schema_mismatch');
  if (receipt.issuer !== GREAT_SCALE_G6_RECEIPT_ISSUER) add('g6_receipt_issuer_mismatch');
  if (receipt.keyId !== receiptKeyId) add('g6_receipt_key_id_mismatch');
  if (receipt.environment !== 'production') add('g6_receipt_environment_mismatch');
  if (receipt.canonicalization !== 'great-scale.canonical-json/v1') add('g6_receipt_canonicalization_mismatch');
  if (receipt.signatureAlgorithm !== 'Ed25519') add('g6_receipt_signature_algorithm_mismatch');
  if (!exactDigest(receipt.digest)) add('g6_receipt_digest_invalid');
  if (typeof receipt.signature !== 'string' || !BASE64_ED25519.test(receipt.signature)) {
    add('g6_receipt_signature_invalid');
  }

  if (!isExactObject(receipt.source, SOURCE_KEYS)) {
    add('g6_receipt_source_shape_invalid');
  } else {
    if (receipt.source.repository !== GREAT_SCALE_REPOSITORY) add('g6_receipt_source_repository_mismatch');
    if (!exactSha(receipt.source.commitSha) || receipt.source.commitSha !== expected.sourceCommitSha) {
      add('g6_receipt_source_commit_mismatch');
    }
  }

  if (!isExactObject(receipt.execution, EXECUTION_KEYS)) {
    add('g6_receipt_execution_shape_invalid');
  } else {
    const runId = receipt.execution.runId;
    const expectedRunUrl = 'https://github.com/' + GREAT_SCALE_REPOSITORY +
      '/actions/runs/' + String(runId);
    if (!safePositiveInteger(runId) || runId !== expected.runId) add('g6_receipt_run_id_mismatch');
    if (!safePositiveInteger(receipt.execution.runAttempt) ||
        receipt.execution.runAttempt !== expected.runAttempt) add('g6_receipt_run_attempt_mismatch');
    if (receipt.execution.runUrl !== expectedRunUrl || !validHttpsUrl(receipt.execution.runUrl)) {
      add('g6_receipt_run_url_mismatch');
    }
    if (receipt.execution.headSha !== receipt.source?.commitSha) add('g6_receipt_head_sha_mismatch');
    if (receipt.execution.conclusion !== 'success') add('g6_receipt_run_not_successful');
  }

  if (!isExactObject(receipt.artifact, ARTIFACT_KEYS)) {
    add('g6_receipt_artifact_shape_invalid');
  } else {
    if (receipt.artifact.name !== expected.modelArtifactName) add('g6_receipt_model_artifact_name_mismatch');
    if (receipt.artifact.digest !== expected.modelArtifactDigest ||
        !validArtifactDigest(receipt.artifact.digest)) add('g6_receipt_model_artifact_digest_mismatch');
  }

  if (!isExactObject(receipt.model, MODEL_KEYS)) {
    add('g6_receipt_model_shape_invalid');
  } else {
    if (receipt.model.id !== 'qi-wu-zhang-two-band') add('g6_receipt_model_id_mismatch');
    if (receipt.model.version !== expected.modelVersion) add('g6_receipt_model_version_mismatch');
    if (!isExactObject(receipt.model.parameters, MODEL_PARAMETER_KEYS)) {
      add('g6_receipt_model_parameters_shape_invalid');
    } else {
      for (const key of MODEL_PARAMETER_KEYS) {
        if (receipt.model.parameters[key] !== expected.modelParameters[key]) {
          add('g6_receipt_model_parameter_mismatch_' + key);
        }
      }
    }
    if (receipt.model.inputDigest !== expected.modelInputDigest ||
        !exactDigest(receipt.model.inputDigest)) add('g6_receipt_model_input_digest_mismatch');
  }

  if (!isExactObject(receipt.target, TARGET_KEYS)) {
    add('g6_receipt_target_shape_invalid');
  } else {
    if (receipt.target.repository !== expected.targetRepository) add('g6_receipt_target_repository_mismatch');
    if (!exactSha(receipt.target.commitSha) || receipt.target.commitSha !== expected.targetCommitSha) {
      add('g6_receipt_target_commit_mismatch');
    }
  }

  if (!isExactObject(receipt.targetArtifact, ARTIFACT_KEYS)) {
    add('g6_receipt_target_artifact_shape_invalid');
  } else {
    if (receipt.targetArtifact.name !== expected.targetArtifactName) add('g6_receipt_target_artifact_name_mismatch');
    if (receipt.targetArtifact.digest !== expected.targetArtifactDigest ||
        !validArtifactDigest(receipt.targetArtifact.digest)) add('g6_receipt_target_artifact_digest_mismatch');
  }

  if (receipt.measurementBuildId !== expected.measurementBuildId ||
      !hasText(receipt.measurementBuildId)) add('g6_receipt_measurement_build_id_mismatch');
  if (receipt.targetBuildId !== expected.targetBuildId || !hasText(receipt.targetBuildId)) {
    add('g6_receipt_target_build_id_mismatch');
  }

  const measurement = receipt.measurement;
  if (!isExactObject(measurement, MEASUREMENT_KEYS)) {
    add('g6_receipt_measurement_shape_invalid');
  } else {
    for (const key of MEASUREMENT_KEYS) {
      const value = measurement[key];
      if (BOOLEAN_MEASUREMENT_KEYS.has(key)) {
        if (typeof value !== 'boolean') add('g6_measurement_boolean_invalid_' + key);
      } else if (key === 'errorBoundMethod') {
        if (value !== 'richardson-asymptotic-estimate-only') add('g6_measurement_error_bound_method_mismatch');
      } else if (typeof value !== 'number' || !Number.isFinite(value)) {
        add('g6_measurement_number_invalid_' + key);
      } else if (NON_NEGATIVE_MEASUREMENT_KEYS.has(key) && value < 0) {
        add('g6_measurement_negative_value_' + key);
      }
    }

    if (!Number.isSafeInteger(measurement.chernNumber)) add('g6_measurement_chern_number_not_integer');
    if (!(measurement.metricAreaBudget > 0)) add('g6_measurement_metric_area_not_positive');
    if (!(measurement.quadratureTolerance > 0)) add('g6_measurement_tolerance_invalid');
    if (measurement.topologicalSaturation < 0 || measurement.topologicalSaturation > 1) {
      add('g6_measurement_topological_saturation_out_of_domain');
    }
    if (measurement.signedTopologicalPolarization < -1 ||
        measurement.signedTopologicalPolarization > 1) {
      add('g6_measurement_signed_polarization_out_of_domain');
    }
    if (measurement.STopological < 0 || measurement.STopological > 0.25) {
      add('g6_measurement_topological_residual_invalid');
    }
    if (measurement.psiTopological < 0 || measurement.acceptedPsiTopological < 0) {
      add('g6_measurement_psi_out_of_domain');
    }
    if (!Number.isSafeInteger(measurement.refinementCount) ||
        measurement.refinementCount < 1 || measurement.refinementCount > 5) {
      add('g6_measurement_refinement_count_invalid');
    }
    if (!Number.isSafeInteger(measurement.refinedGridSize) ||
        measurement.refinedGridSize < 8 || measurement.refinedGridSize > 131072) {
      add('g6_measurement_refined_grid_size_invalid');
    }

    const tolerance = measurement.quadratureTolerance;
    if (Number.isFinite(tolerance) && tolerance > 0) {
      if (measurement.chernIntegerResidual > 1e-6) add('g6_measurement_chern_integer_residual_exceeds_limit');
      if (Number.isFinite(measurement.rawChernNumber) && Number.isFinite(measurement.chernNumber)) {
        const observedIntegerResidual = Math.abs(measurement.rawChernNumber - measurement.chernNumber);
        if (!approximatelyEqual(observedIntegerResidual, measurement.chernIntegerResidual, 1e-10)) {
          add('g6_measurement_raw_chern_residual_mismatch');
        }
      }
      for (const key of TOLERANCE_RESIDUAL_KEYS) {
        if (Number.isFinite(measurement[key])) {
          const allowed = ['curvatureCancellationIdentityResidual', 'curvatureOrientationEntropyResidual'].includes(key)
            ? 2 * tolerance : tolerance;
          if (measurement[key] > allowed) add('g6_measurement_residual_over_tolerance_' + key);
        }
      }

      // The model's integrated curvature is in the same normalized units as
      // chernNumber; the source computes |integratedCurvature - chernNumber|.
      if (!approximatelyEqual(
        measurement.curvatureChernResidual,
        Math.abs(measurement.integratedCurvature - measurement.chernNumber),
        tolerance,
      )) add('g6_measurement_curvature_chern_residual_mismatch');
      if (!approximatelyEqual(measurement.integratedCurvature, measurement.chernNumber, tolerance)) {
        add('g6_measurement_integrated_curvature_mismatch');
      }
      if (!approximatelyEqual(
        measurement.absoluteCurvatureBudget,
        measurement.positiveCurvatureBudget + measurement.negativeCurvatureBudget,
        tolerance,
      )) add('g6_measurement_curvature_budget_sum_mismatch');
      if (!approximatelyEqual(
        measurement.curvatureCancellationBudget,
        Math.max(0, measurement.absoluteCurvatureBudget - Math.abs(measurement.integratedCurvature)),
        tolerance,
      )) add('g6_measurement_curvature_cancellation_budget_mismatch');
      if (measurement.metricAreaBudget < measurement.topologicalFloor - tolerance) {
        add('g6_measurement_metric_area_below_topological_floor');
      }
      if (!approximatelyEqual(
        measurement.metricAreaExcess,
        measurement.metricAreaBudget - measurement.topologicalFloor,
        tolerance,
      )) add('g6_measurement_metric_area_excess_mismatch');
      if (!approximatelyEqual(
        measurement.topologicalFloor,
        Math.abs(measurement.chernNumber),
        tolerance,
      )) add('g6_measurement_topological_floor_mismatch');

      const expectedSaturationRaw = measurement.metricAreaBudget > 1e-12
        ? measurement.topologicalFloor / measurement.metricAreaBudget : 0;
      if (!approximatelyEqual(measurement.topologicalSaturationRaw, expectedSaturationRaw, tolerance)) {
        add('g6_measurement_raw_topological_saturation_mismatch');
      }
      const expectedSaturation = Math.max(0, Math.min(1, expectedSaturationRaw));
      if (!approximatelyEqual(measurement.topologicalSaturation, expectedSaturation, tolerance)) {
        add('g6_measurement_topological_saturation_mismatch');
      }
      const expectedS = (1 - measurement.topologicalSaturation * measurement.topologicalSaturation) / 4;
      if (!approximatelyEqual(measurement.STopological, expectedS, tolerance)) {
        add('g6_measurement_topological_residual_invalid');
      }
      const phi = (1 + Math.sqrt(5)) / 2;
      const cone = (phi - 1) * (phi - 1);
      if (!approximatelyEqual(measurement.psiTopological, cone + measurement.STopological, tolerance)) {
        add('g6_measurement_psi_mismatch');
      }
      const polarization = Math.sign(measurement.chernNumber) * measurement.topologicalSaturation;
      if (!approximatelyEqual(measurement.signedTopologicalPolarization, polarization, tolerance)) {
        add('g6_measurement_signed_polarization_mismatch');
      }
      if (!approximatelyEqual(measurement.acceptedPsiTopological, measurement.psiTopological, tolerance)) {
        add('g6_measurement_accepted_psi_mismatch');
      }

      const positiveBudget = measurement.positiveCurvatureBudget;
      const negativeBudget = measurement.negativeCurvatureBudget;
      const totalCurvatureBudget = positiveBudget + negativeBudget;
      if (totalCurvatureBudget > 1e-12 && measurement.metricAreaBudget > 0) {
        const orientationProbability = (1 + measurement.signedTopologicalPolarization) / 2;
        const budgetProbability = positiveBudget / totalCurvatureBudget;
        const expectedEntropyResidual = Math.abs(
          binaryEntropyNats(orientationProbability) - binaryEntropyNats(budgetProbability),
        );
        if (!approximatelyEqual(
          measurement.curvatureOrientationEntropyResidual, expectedEntropyResidual, tolerance,
        )) add('g6_measurement_orientation_entropy_residual_mismatch');
        const mixingIndex = (positiveBudget * negativeBudget) /
          (measurement.metricAreaBudget * measurement.metricAreaBudget);
        const expectedVarianceResidual = Math.abs(
          4 * measurement.STopological - 4 * mixingIndex,
        );
        if (!approximatelyEqual(
          measurement.curvatureOrientationVarianceResidual, expectedVarianceResidual, tolerance,
        )) add('g6_measurement_orientation_variance_residual_mismatch');
        const cancellationIdentity = Math.abs(
          measurement.metricAreaExcess - 2 * Math.min(positiveBudget, negativeBudget),
        );
        if (!approximatelyEqual(
          measurement.curvatureCancellationIdentityResidual, cancellationIdentity, tolerance,
        )) add('g6_measurement_cancellation_identity_residual_mismatch');
      } else {
        add('g6_measurement_curvature_budgets_degenerate');
      }

      if (measurement.curvatureErrorEstimateWithSafetyFactor > tolerance ||
          measurement.metricAreaErrorEstimateWithSafetyFactor > tolerance) {
        add('g6_measurement_empirical_estimate_exceeds_tolerance');
      }
      if (measurement.quadratureConverged !== true) add('g6_measurement_not_converged');
      if (measurement.topologicalMappingValid !== true) add('g6_measurement_topological_mapping_invalid');
      if (measurement.errorEstimatesFinite !== true) add('g6_measurement_empirical_estimates_not_finite');
    }
  }

  const certificate = receipt.numericalCertification;
  if (!isExactObject(certificate, NUMERICAL_CERTIFICATION_KEYS)) {
    add('g6_numerical_certification_shape_invalid');
  } else {
    const methods = ['interval-enclosure-v1', 'analytic-derivative-bound-v1'];
    if (!methods.includes(certificate.method)) add('g6_numerical_certificate_method_unapproved');
    if (certificate.verifierId !== expected.numericalVerifierId) add('g6_numerical_certificate_verifier_mismatch');
    if (certificate.certificateKeyId !== numericalCertificateKeyId) {
      add('g6_numerical_certificate_key_id_mismatch');
    }
    if (certificate.sourceCommitSha !== receipt.source?.commitSha ||
        certificate.sourceCommitSha !== expected.sourceCommitSha) {
      add('g6_numerical_certificate_source_commit_mismatch');
    }
    if (certificate.modelInputDigest !== receipt.model?.inputDigest ||
        certificate.modelInputDigest !== expected.modelInputDigest) {
      add('g6_numerical_certificate_model_input_digest_mismatch');
    }
    if (!exactDigest(certificate.measurementDigest) ||
        !measurement || typeof measurement !== 'object' || Array.isArray(measurement)) {
      add('g6_numerical_certificate_measurement_digest_invalid');
    } else {
      const actualMeasurementDigest = sha256Hex(
        Buffer.from(canonicalG6ReceiptJson(measurement), 'utf8'),
      );
      if (certificate.measurementDigest !== actualMeasurementDigest) {
        add('g6_numerical_certificate_measurement_digest_mismatch');
      }
    }
    if (certificate.verified !== true) add('g6_numerical_certificate_not_marked_verified');
    if (!exactDigest(certificate.proofDigest)) add('g6_numerical_certificate_proof_digest_invalid');
    if (!validHttpsUrl(certificate.evidenceUrl)) {
      add('g6_numerical_certificate_evidence_url_invalid');
    } else {
      const evidenceUrl = new URL(certificate.evidenceUrl);
      if (evidenceUrl.origin !== expected.numericalCertificateEvidenceOrigin) {
        add('g6_numerical_certificate_evidence_origin_mismatch');
      }
    }
    if (!proofEvidence || certificate.evidenceUrl !== proofEvidence.url) {
      add('g6_numerical_certificate_evidence_url_mismatch');
    } else if (proofEvidence.bytes instanceof Uint8Array &&
        sha256Hex(proofEvidence.bytes) !== certificate.proofDigest) {
      add('g6_numerical_certificate_proof_digest_mismatch');
    }
    if (!Number.isFinite(certificate.curvatureErrorUpperBound) ||
        certificate.curvatureErrorUpperBound < 0 ||
        !Number.isFinite(certificate.metricAreaErrorUpperBound) ||
        certificate.metricAreaErrorUpperBound < 0) {
      add('g6_numerical_certificate_error_bounds_invalid');
    } else if (Number.isFinite(measurement?.quadratureTolerance) &&
        (certificate.curvatureErrorUpperBound > measurement.quadratureTolerance ||
         certificate.metricAreaErrorUpperBound > measurement.quadratureTolerance)) {
      add('g6_numerical_certificate_error_bound_exceeds_tolerance');
    }
    if (typeof certificate.certificateSignature !== 'string' ||
        !BASE64_ED25519.test(certificate.certificateSignature)) {
      add('g6_numerical_certificate_signature_invalid');
    }
  }

  const timestampNames = [
    'generatedAt', 'expiresAt', 'measuredAt',
    'execution.startedAt', 'execution.completedAt',
    'numericalCertification.generatedAt', 'numericalCertification.expiresAt',
  ];
  const timestamps = {
    generatedAt: parseStrictTimestamp(receipt.generatedAt),
    expiresAt: parseStrictTimestamp(receipt.expiresAt),
    measuredAt: parseStrictTimestamp(receipt.measuredAt),
    startedAt: parseStrictTimestamp(receipt.execution?.startedAt),
    completedAt: parseStrictTimestamp(receipt.execution?.completedAt),
    certificateGeneratedAt: parseStrictTimestamp(certificate?.generatedAt),
    certificateExpiresAt: parseStrictTimestamp(certificate?.expiresAt),
  };
  for (const key of timestampNames) {
    const mapped = key.startsWith('execution.')
      ? key.slice('execution.'.length)
      : key.startsWith('numericalCertification.')
        ? key.slice('numericalCertification.'.length)
        : key;
    const actualKey = key === 'numericalCertification.generatedAt' ? 'certificateGeneratedAt'
      : key === 'numericalCertification.expiresAt' ? 'certificateExpiresAt'
      : mapped;
    if (!Number.isFinite(timestamps[actualKey])) add('g6_timestamp_invalid_' + key.replaceAll('.', '_'));
  }
  const { generatedAt, expiresAt, measuredAt, startedAt, completedAt, certificateGeneratedAt, certificateExpiresAt } = timestamps;
  if ([generatedAt, expiresAt, measuredAt, startedAt, completedAt, certificateGeneratedAt, certificateExpiresAt].every(Number.isFinite)) {
    if (expiresAt <= generatedAt || expiresAt - generatedAt > maxAgeMs) add('g6_receipt_expiry_window_invalid');
    if (expiresAt <= now) add('g6_receipt_expired');
    if (generatedAt > now + maxClockSkewMs) add('g6_receipt_generated_in_future');
    if (now - generatedAt > maxAgeMs) add('g6_receipt_stale');
    if (startedAt > completedAt) add('g6_execution_time_order_invalid');
    if (completedAt > now + maxClockSkewMs) add('g6_execution_completed_in_future');
    if (generatedAt < completedAt - maxClockSkewMs) add('g6_receipt_generated_before_execution_completed');
    if (measuredAt < startedAt - maxClockSkewMs || measuredAt > completedAt + maxClockSkewMs) {
      add('g6_measurement_outside_execution_window');
    }
    if (measuredAt > now + maxClockSkewMs || now - measuredAt > maxAgeMs) add('g6_measurement_stale_or_future');
    if (certificateExpiresAt <= certificateGeneratedAt ||
        certificateExpiresAt - certificateGeneratedAt > maxAgeMs) add('g6_numerical_certificate_expiry_window_invalid');
    if (certificateExpiresAt <= now) add('g6_numerical_certificate_expired');
    if (certificateGeneratedAt > now + maxClockSkewMs || now - certificateGeneratedAt > maxAgeMs) {
      add('g6_numerical_certificate_stale_or_future');
    }
    if (certificateGeneratedAt > generatedAt + maxClockSkewMs) {
      add('g6_numerical_certificate_generated_after_receipt');
    }
    if (expiresAt > certificateExpiresAt) add('g6_receipt_outlives_numerical_certificate');
    if (measuredAt > certificateGeneratedAt + maxClockSkewMs) {
      add('g6_numerical_certificate_predates_measurement');
    }
  }

  // Do not try cryptographic verification until basic key material and signature shapes are present.
  try {
    if (typeof receipt.signature === 'string' && BASE64_ED25519.test(receipt.signature) &&
        typeof receipt.digest === 'string' && SHA256_HEX.test(receipt.digest)) {
      const unsignedReceipt = { ...receipt };
      delete unsignedReceipt.digest;
      delete unsignedReceipt.signature;
      const canonical = canonicalG6ReceiptJson(unsignedReceipt);
      if (sha256Hex(Buffer.from(canonical, 'utf8')) !== receipt.digest) {
        add('g6_receipt_digest_mismatch');
      } else {
        const key = createPublicKey(receiptPublicKeyPem);
        if (key.asymmetricKeyType !== 'ed25519' ||
            !verifySignature(null, Buffer.from(canonical, 'utf8'), key, Buffer.from(receipt.signature, 'base64'))) {
          add('g6_receipt_signature_verification_failed');
        }
      }
    }
  } catch {
    add('g6_receipt_signature_verification_failed');
  }

  try {
    if (certificate && typeof certificate.certificateSignature === 'string' &&
        BASE64_ED25519.test(certificate.certificateSignature)) {
      const unsignedCertificate = { ...certificate };
      delete unsignedCertificate.certificateSignature;
      const canonicalCertificate = canonicalG6ReceiptJson(unsignedCertificate);
      const key = createPublicKey(numericalCertificatePublicKeyPem);
      if (key.asymmetricKeyType !== 'ed25519' ||
          !verifySignature(null, Buffer.from(canonicalCertificate, 'utf8'), key,
            Buffer.from(certificate.certificateSignature, 'base64'))) {
        add('g6_numerical_certificate_signature_verification_failed');
      }
    }
  } catch {
    add('g6_numerical_certificate_signature_verification_failed');
  }

  if (failures.length) return { valid: false, failures };

  return {
    valid: true,
    failures: [],
    residual: {
      schema: 'great-scale.residual-attestation/v1',
      sourceId: receipt.issuer,
      buildId: receipt.targetBuildId,
      measuredAt: receipt.measuredAt,
      S: receipt.measurement.STopological,
    },
    verified: {
      receiptDigest: receipt.digest,
      certificateProofDigest: receipt.numericalCertification.proofDigest,
      sourceCommitSha: receipt.source.commitSha,
      targetCommitSha: receipt.target.commitSha,
      measurementBuildId: receipt.measurementBuildId,
      targetBuildId: receipt.targetBuildId,
      targetArtifactDigest: receipt.targetArtifact.digest,
      certifiedUpperBounds: {
        curvature: receipt.numericalCertification.curvatureErrorUpperBound,
        metricArea: receipt.numericalCertification.metricAreaErrorUpperBound,
      },
    },
  };
}

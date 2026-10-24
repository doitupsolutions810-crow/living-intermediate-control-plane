/**
 * Structural and internal-consistency checks for the proposed Great Scale
 * evidence envelope. This module does not authenticate signatures, establish
 * provenance, verify capabilities, or authorize actions; those remain separate
 * trust gates enforced by the caller's trusted verification path.
 */
export const GREAT_SCALE_EVIDENCE_SCHEMA = 'great-scale.evidence/v1';
export const GREAT_SCALE_CONE = ((1 + Math.sqrt(5)) / 2) ** -2;

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const finiteOrNull = value => value === null || (typeof value === 'number' && Number.isFinite(value));
const close = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sha256 = value => typeof value === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/i.test(value);

export function validateGreatScaleEvidence(evidence, { tolerance = 1e-8, now = Date.now() } = {}) {
  const errors = [];
  const add = message => errors.push(message);
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new TypeError('tolerance must be a finite nonnegative number');
  if (!Number.isFinite(now)) throw new TypeError('now must be a finite timestamp');
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return { valid: false, errors: ['evidence must be an object'] };

  if (evidence.schema !== GREAT_SCALE_EVIDENCE_SCHEMA) add('unsupported schema');
  if (!nonempty(evidence.claim_id)) add('claim_id must be a nonempty string');

  const producer = evidence.producer;
  if (!producer || typeof producer !== 'object' || Array.isArray(producer)) add('producer must be an object');
  else {
    if (typeof producer.repository !== 'string' || !/^[^/]+\/[^/]+$/.test(producer.repository)) add('producer.repository must be owner/repository');
    if (typeof producer.commit !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i.test(producer.commit)) add('producer.commit must be a full 40- or 64-character hex SHA');
    if (!nonempty(producer.path)) add('producer.path must be a nonempty string');
    if (!producer.runtime || typeof producer.runtime !== 'object' || Array.isArray(producer.runtime)) add('producer.runtime must be an object');
  }

  const model = evidence.model;
  if (!model || typeof model !== 'object' || typeof model.name !== 'string' || !model.name.trim()) add('model.name must be a nonempty string');
  if (!model || typeof model.parameters !== 'object' || model.parameters === null || Array.isArray(model.parameters)) add('model.parameters must be an object');
  if (!model || typeof model.conventions !== 'object' || model.conventions === null || Array.isArray(model.conventions)) add('model.conventions must be an object');

  const claim = evidence.claim;
  if (!claim || typeof claim !== 'object') add('claim must be an object');
  else {
    if (!nonempty(claim.class)) add('claim.class must be a nonempty string');
    if (!nonempty(claim.formula_version)) add('claim.formula_version must be a nonempty string');
    if (!Array.isArray(claim.assumptions) || claim.assumptions.some(x => typeof x !== 'string')) add('claim.assumptions must be an array of strings');
  }

  const result = evidence.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) add('result must be an object');
  else {
    const resultKeys = ['chern_number', 'metric_area_budget', 'metric_area_excess', 'topological_saturation', 'great_scale_scalar'];
    for (const key of resultKeys) {
      if (!own(result, key)) add(`result.${key} is required (use null when unknown)`);
      else if (!finiteOrNull(result[key])) add(`result.${key} must be finite or null`);
    }
    const { chern_number: C, metric_area_budget: A, metric_area_excess: E, topological_saturation: tau, great_scale_scalar: psi } = result;
    if (A != null && A < 0) add('metric_area_budget must be nonnegative');
    if (E != null && E < -tolerance) add('metric_area_excess must be nonnegative');
    if (tau != null && (tau < -tolerance || tau > 1 + tolerance)) add('topological_saturation must lie in [0,1]');
    if (A != null && C != null) {
      if (A + tolerance < Math.abs(C)) add('metric area lower bound violated: A_Q < |C|');
      if (A > tolerance) {
        const expectedExcess = A - Math.abs(C);
        if (E != null && !close(E, expectedExcess, tolerance)) add('metric_area_excess inconsistent with A_Q - |C|');
        const expectedTau = Math.abs(C) / A;
        if (tau != null && !close(tau, expectedTau, tolerance)) add('topological_saturation inconsistent with |C| / metric_area_budget');
        const expectedPsi = GREAT_SCALE_CONE + (1 - (C / A) ** 2) / 4;
        if (psi != null && !close(psi, expectedPsi, tolerance)) add('great_scale_scalar inconsistent with C / metric_area_budget');
      } else if (Math.abs(C) <= tolerance && (tau != null || psi != null)) {
        add('zero metric area with zero Chern number has undefined polarization; saturation and scalar must be null');
      }
    }
  }

  const validation = evidence.validation;
  if (!validation || typeof validation !== 'object' || Array.isArray(validation)) add('validation must be an object');
  else {
    for (const key of ['domain_valid', 'converged']) if (typeof validation[key] !== 'boolean') add(`validation.${key} must be boolean`);
    for (const key of ['chern_integer_residual', 'signed_curvature_residual', 'area_refinement_residual', 'grid_origin_residual', 'cancellation_residual', 'entropy_residual']) {
      if (!own(validation, key) || !finiteOrNull(validation[key])) add(`validation.${key} must be present and finite or null`);
    }
    if (!['provisional', 'accepted', 'rejected', 'indeterminate'].includes(validation.acceptance)) add('validation.acceptance is invalid');
    if (validation.acceptance === 'accepted' && (validation.domain_valid !== true || validation.converged !== true)) {
      add('accepted evidence requires domain_valid and converged to be true');
    }
  }

  const execution = evidence.execution;
  if (!execution || typeof execution !== 'object' || Array.isArray(execution)) add('execution must be an object');
  else {
    if (!nonempty(execution.command)) add('execution.command must be a nonempty string');
    if (!(execution.exit_code === null || Number.isInteger(execution.exit_code))) add('execution.exit_code must be an integer or null');
  }

  const integrity = evidence.integrity;
  if (!integrity || typeof integrity !== 'object' || Array.isArray(integrity)) add('integrity must be an object');
  else {
    if (!nonempty(integrity.canonicalization)) add('integrity.canonicalization must be a nonempty string');
    if (!(integrity.artifact_digest === null || sha256(integrity.artifact_digest))) add('integrity.artifact_digest must be null or a SHA-256 digest');
    if (!(integrity.signature_ref === null || nonempty(integrity.signature_ref))) add('integrity.signature_ref must be a nonempty string or null');
  }

  const authorization = evidence.authorization;
  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization)) {
    add('authorization must be an object');
  } else {
    if (!['not_requested', 'authorized', 'denied', 'indeterminate'].includes(authorization.status)) add('authorization.status is invalid');
    if (!(authorization.capability_ref === null || nonempty(authorization.capability_ref))) add('authorization.capability_ref must be a nonempty string or null');
    if (!(authorization.audience === null || nonempty(authorization.audience))) add('authorization.audience must be a nonempty string or null');
    if (!(authorization.operation === null || nonempty(authorization.operation))) add('authorization.operation must be a nonempty string or null');
    if (!(authorization.expires_at === null || (typeof authorization.expires_at === 'string' && Number.isFinite(Date.parse(authorization.expires_at))))) add('authorization.expires_at must be a parseable timestamp or null');
    if (!(authorization.verification_ref === null || nonempty(authorization.verification_ref))) add('authorization.verification_ref must be a nonempty string or null');

    if (validation?.acceptance === 'accepted') {
      if (authorization.status !== 'authorized') add('accepted evidence requires authorization.status authorized');
      if (!nonempty(authorization.capability_ref)) add('accepted evidence requires authorization.capability_ref');
      if (!nonempty(authorization.audience)) add('accepted evidence requires authorization.audience');
      if (!nonempty(authorization.operation)) add('accepted evidence requires authorization.operation');
      if (!nonempty(authorization.verification_ref)) add('accepted evidence requires authorization.verification_ref');
      if (!authorization.expires_at || !Number.isFinite(Date.parse(authorization.expires_at)) || Date.parse(authorization.expires_at) <= now) {
        add('accepted evidence requires a capability that is not expired at validation time');
      }
      if (execution?.exit_code !== 0) add('accepted evidence requires execution.exit_code 0');
      if (!sha256(integrity?.artifact_digest)) add('accepted evidence requires a SHA-256 artifact digest');
      if (!nonempty(integrity?.signature_ref)) add('accepted evidence requires a signature reference');
    }
  }

  return { valid: errors.length === 0, errors };
}

export default { validateGreatScaleEvidence, GREAT_SCALE_EVIDENCE_SCHEMA, GREAT_SCALE_CONE };

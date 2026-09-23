import crypto from 'node:crypto';

/**
 * Federation digest v1 — belief + spectrum tension only (no secrets).
 * Optional observationDigest links a lattice observation hash.
 */
export function buildFederationDigest({
  belief = 0.5,
  tension = 0,
  partialCount = 0,
  securitySeverity = 'ok',
  label = 'local',
  observationDigest = null
} = {}) {
  const payload = {
    v: 1,
    at: new Date().toISOString(),
    label,
    belief: Number(Number(belief).toFixed(4)),
    tension: Number(Number(tension).toFixed(4)),
    partialCount: Number(partialCount) || 0,
    securitySeverity: String(securitySeverity || 'ok'),
    observationDigest: observationDigest ? String(observationDigest).slice(0, 64) : null
  };
  const body = JSON.stringify({
    v: payload.v,
    at: payload.at,
    label: payload.label,
    belief: payload.belief,
    tension: payload.tension,
    partialCount: payload.partialCount,
    securitySeverity: payload.securitySeverity,
    observationDigest: payload.observationDigest
  });
  return {
    ...payload,
    digest: crypto.createHash('sha256').update(body).digest('hex')
  };
}

/** Hash a free-form lattice observation string for federation linkage. */
export function hashObservation(observationText) {
  return crypto.createHash('sha256').update(String(observationText || '')).digest('hex');
}

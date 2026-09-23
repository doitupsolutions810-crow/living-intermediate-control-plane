import crypto from 'node:crypto';

/**
 * Federation digest v1 — belief + spectrum tension only (no secrets).
 * Optional observationDigest / multiBeliefDigest / consensus telemetry.
 */
export function buildFederationDigest({
  belief = 0.5,
  tension = 0,
  partialCount = 0,
  securitySeverity = 'ok',
  label = 'local',
  observationDigest = null,
  multiBeliefDigest = null,
  meanBelief = null,
  nodeCount = null,
  consensusMean = null,
  consensusAt = null
} = {}) {
  const payload = {
    v: 1,
    at: new Date().toISOString(),
    label,
    belief: Number(Number(belief).toFixed(4)),
    tension: Number(Number(tension).toFixed(4)),
    partialCount: Number(partialCount) || 0,
    securitySeverity: String(securitySeverity || 'ok'),
    observationDigest: observationDigest ? String(observationDigest).slice(0, 64) : null,
    multiBeliefDigest: multiBeliefDigest ? String(multiBeliefDigest).slice(0, 64) : null,
    meanBelief: meanBelief != null ? Number(Number(meanBelief).toFixed(4)) : null,
    nodeCount: nodeCount != null ? Number(nodeCount) : null,
    consensusMean: consensusMean != null ? Number(Number(consensusMean).toFixed(4)) : null,
    consensusAt: consensusAt ? String(consensusAt) : null
  };
  const body = JSON.stringify({
    v: payload.v,
    at: payload.at,
    label: payload.label,
    belief: payload.belief,
    tension: payload.tension,
    partialCount: payload.partialCount,
    securitySeverity: payload.securitySeverity,
    observationDigest: payload.observationDigest,
    multiBeliefDigest: payload.multiBeliefDigest,
    meanBelief: payload.meanBelief,
    nodeCount: payload.nodeCount,
    consensusMean: payload.consensusMean,
    consensusAt: payload.consensusAt
  });
  return {
    ...payload,
    digest: crypto.createHash('sha256').update(body).digest('hex')
  };
}

export function hashObservation(observationText) {
  return crypto.createHash('sha256').update(String(observationText || '')).digest('hex');
}

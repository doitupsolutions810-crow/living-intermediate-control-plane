import crypto from 'node:crypto';

export function buildFederationDigest({
  belief = 0.5,
  tension = 0,
  partialCount = 0,
  securitySeverity = 'ok',
  label = 'local'
} = {}) {
  const payload = {
    v: 1,
    at: new Date().toISOString(),
    label,
    belief: Number(Number(belief).toFixed(4)),
    tension: Number(Number(tension).toFixed(4)),
    partialCount,
    securitySeverity
  };
  const body = JSON.stringify(payload);
  return {
    ...payload,
    digest: crypto.createHash('sha256').update(body).digest('hex')
  };
}

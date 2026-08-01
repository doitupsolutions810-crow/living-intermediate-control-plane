import crypto from 'node:crypto';

export function digestPolicy(policyObject) {
  const body = JSON.stringify(policyObject || {});
  return {
    at: new Date().toISOString(),
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
    bytes: Buffer.byteLength(body)
  };
}

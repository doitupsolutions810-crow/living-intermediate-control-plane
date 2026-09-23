/**
 * Shared attestation key: Node SBOM sha256 ↔ AVRONE training/route session_id.
 * Optional multiBeliefDigest + HMAC seal when CONTROL12_ATTEST_HMAC_KEY is set.
 * Evidence only — does not open execution gates.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function buildSessionLink({
  sessionId,
  turnId = null,
  latticeObservation = null,
  sbomSha256 = null,
  latticeRoot = 'avrone-duekrey',
  multiBeliefDigest = null,
  meanBelief = null,
  nodeCount = null
} = {}) {
  if (!sessionId) {
    throw Object.assign(new Error('sessionId required'), { statusCode: 400 });
  }
  const record = {
    schema: 'control12.attestation-session-link/v1',
    at: new Date().toISOString(),
    latticeRoot,
    sessionId: String(sessionId),
    turnId: turnId ? String(turnId) : null,
    sbomSha256: sbomSha256 ? String(sbomSha256) : null,
    observationSha256: latticeObservation
      ? crypto.createHash('sha256').update(String(latticeObservation)).digest('hex')
      : null,
    multiBeliefDigest: multiBeliefDigest ? String(multiBeliefDigest).slice(0, 64) : null,
    meanBelief: meanBelief != null ? Number(Number(meanBelief).toFixed(4)) : null,
    nodeCount: nodeCount != null ? Number(nodeCount) : null
  };
  const body = JSON.stringify(record);
  record.linkDigest = crypto.createHash('sha256').update(body).digest('hex');
  const hmacKey = process.env.CONTROL12_ATTEST_HMAC_KEY || '';
  if (hmacKey) {
    record.signature = crypto
      .createHmac('sha256', hmacKey)
      .update(record.linkDigest)
      .digest('hex');
    record.signed = true;
  } else {
    record.signature = null;
    record.signed = false;
  }
  return record;
}

export function createSessionLinkStore(attestationDir) {
  const file = path.join(attestationDir, 'session-links.jsonl');
  return {
    async append(link) {
      await fs.mkdir(attestationDir, { recursive: true });
      await fs.appendFile(file, JSON.stringify(link) + '\n', 'utf8');
      return link;
    },
    async list(limit = 50) {
      try {
        const text = await fs.readFile(file, 'utf8');
        const lines = text.trim().split('\n').filter(Boolean);
        return lines.slice(-limit).map((l) => JSON.parse(l));
      } catch {
        return [];
      }
    }
  };
}

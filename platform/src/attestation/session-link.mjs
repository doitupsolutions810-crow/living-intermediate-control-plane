/**
 * Shared attestation key: Node SBOM sha256 \u2194 AVRONE training/route session_id.
 * Evidence only \u2014 does not open execution gates.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function buildSessionLink({
  sessionId,
  turnId = null,
  latticeObservation = null,
  sbomSha256 = null,
  latticeRoot = 'avrone-duekrey'
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
      : null
  };
  const body = JSON.stringify(record);
  record.linkDigest = crypto.createHash('sha256').update(body).digest('hex');
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
        return lines.slice(-limit).map(l => JSON.parse(l));
      } catch {
        return [];
      }
    }
  };
}

/**
 * Great Scale residual-aware evidence status document (v5.4.0-aligned shape).
 *
 * Carries:
 * - residual snapshot (cascade coordinate, cone, dual atlas)
 * - E0–E6 contract-check entries (procurement namespace only)
 * - optional source timestamp / digest / signature fields (fail-closed when required)
 *
 * Does not claim production (G0–G6) authorization.
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { residualSnapshot, CONE } from './great-scale-residual.mjs';
import { EVIDENCE_GATES } from './gate-namespaces.mjs';

const SCHEMA = 'great-scale.evidence-status/v5.4.0';
const DEFAULT_TTL_MS = 60_000;

/**
 * Canonical JSON for digest (stable key order, no whitespace variance).
 */
export function canonicalJson(value) {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((acc, k) => {
        acc[k] = v[k];
        return acc;
      }, {});
    }
    return v;
  });
}

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Build unsigned status document with residual + E0–E6 checks.
 */
export function buildEvidenceStatusDocument({
  S = 0,
  tau = null,
  roleBlock = 4,
  contractChecks = null,
  ttlMs = DEFAULT_TTL_MS,
  extra = {},
} = {}) {
  if (tau !== null && (!Number.isFinite(tau) || tau < 0 || tau > 1)) {
    throw new TypeError('Topology saturation tau must be finite and within [0, 1].');
  }
  if (tau === null && (!Number.isFinite(S) || S < 0 || S > 0.25)) {
    throw new TypeError('Residual coordinate S must be finite and within [0, 0.25].');
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 5 * 60 * 1000) {
    throw new TypeError('Evidence TTL must be positive and no greater than five minutes.');
  }

  const protectedFields = new Set([
    'schema', 'version', 'generatedAt', 'expiresAt', 'authority', 'residual',
    'contractChecks', 'namespaces', 'productionClaimed', 'gates', 'runtime',
    'sourceIdentity', 'sourceKeyId', 'sourceEvidenceDigest', 'sourceSignature',
  ]);
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
    throw new TypeError('extra must be a plain metadata object.');
  }
  const protectedOverride = Object.keys(extra).find(key => protectedFields.has(key));
  if (protectedOverride) {
    throw new TypeError(`extra cannot override protected evidence field: ${protectedOverride}`);
  }

  const now = Date.now();
  const generatedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();
  const residual = residualSnapshot({ S, tau, roleBlock });

  // A residual cone predicate is not evidence that procurement checks passed.
  // Missing authoritative check results must therefore remain HOLD.
  const checks = contractChecks ?? EVIDENCE_GATES.map(id => ({ id, status: 'HOLD' }));
  if (!Array.isArray(checks)) {
    throw new TypeError('contractChecks must be an array when supplied.');
  }

  // Exact E0–E6, no extra properties on check items
  const normalizedChecks = checks.map(c => ({
    id: c?.id,
    status: c?.status === 'READY' ? 'READY' : 'HOLD',
  }));

  const doc = {
    ...extra,
    schema: SCHEMA,
    version: '5.4.0',
    generatedAt,
    expiresAt,
    authority: 'local',
    residual: {
      logCoord: residual.logCoord,
      S: residual.S,
      n: residual.n,
      psi: residual.psi,
      cone: residual.CONE,
      coneOk: residual.coneOk,
      role: residual.role,
      roleBlock: residual.roleBlock,
    },
    contractChecks: normalizedChecks,
    namespaces: {
      evidence: 'E0-E6',
      production: 'G0-G6',
      independent: true,
    },
  };

  return doc;
}

/**
 * Attach digest + optional Ed25519 signature.
 * Without private key, returns document + digest only (unsigned).
 */
export function sealEvidenceStatusDocument(doc, {
  privateKeyPem = process.env.EVIDENCE_SOURCE_PRIVATE_KEY_PEM || '',
  keyId = process.env.EVIDENCE_SOURCE_KEY_ID || '',
} = {}) {
  const { signature: _drop, digest: _d, keyId: _k, ...body } = doc;
  const payload = canonicalJson(body);
  const digest = sha256Hex(payload);

  const sealed = {
    ...body,
    digest,
    keyId: keyId || null,
    signature: null,
  };

  if (!privateKeyPem || !keyId) {
    sealed.note = 'Unsigned — EVIDENCE_SOURCE_PRIVATE_KEY_PEM / KEY_ID not configured; fail-closed for public authority.';
    return sealed;
  }

  try {
    const key = createPrivateKey(privateKeyPem);
    const sig = sign(null, Buffer.from(payload, 'utf8'), key);
    sealed.signature = sig.toString('base64');
    sealed.note = 'Signed with configured Ed25519 source key.';
  } catch (err) {
    sealed.signature = null;
    sealed.note = `Signing failed (${err.message}); treat as unsigned.`;
  }

  return sealed;
}

/**
 * Verify sealed document under independent public key.
 * Checks: schema, E0–E6 exactness, residual cone, freshness, digest, signature.
 */
export function verifyEvidenceStatusDocument(doc, {
  publicKeyPem = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM || '',
  keyId = process.env.EVIDENCE_SOURCE_KEY_ID || '',
  now = Date.now(),
  requireSignature = true,
} = {}) {
  const failures = [];

  if (!doc || doc.schema !== SCHEMA) {
    failures.push({ code: 'SCHEMA', detail: 'missing or wrong schema' });
  }

  if (!doc?.generatedAt || !doc?.expiresAt) {
    failures.push({ code: 'FRESHNESS', detail: 'missing generatedAt/expiresAt' });
  } else {
    const gen = Date.parse(doc.generatedAt);
    const exp = Date.parse(doc.expiresAt);
    if (!Number.isFinite(gen) || !Number.isFinite(exp)) {
      failures.push({ code: 'FRESHNESS', detail: 'invalid timestamps' });
    } else if (gen > now + 5000) {
      failures.push({ code: 'FRESHNESS', detail: 'generatedAt in the future' });
    } else if (exp <= gen) {
      failures.push({ code: 'FRESHNESS', detail: 'expiresAt must be after generatedAt' });
    } else if (exp - gen > 5 * 60 * 1000) {
      failures.push({ code: 'FRESHNESS', detail: 'evidence TTL exceeds five-minute maximum' });
    } else if (now > exp) {
      failures.push({ code: 'FRESHNESS', detail: 'document expired' });
    }
  }

  const checks = doc?.contractChecks;
  if (!Array.isArray(checks) || checks.length !== 7) {
    failures.push({ code: 'E_GATES', detail: 'contractChecks must be exactly 7 items' });
  } else {
    const ids = checks.map(c => c?.id).sort().join(',');
    const expected = [...EVIDENCE_GATES].sort().join(',');
    if (ids !== expected) {
      failures.push({ code: 'E_GATES', detail: `expected ids ${expected}, got ${ids}` });
    }
    for (const c of checks) {
      const keys = Object.keys(c || {}).sort().join(',');
      if (keys !== 'id,status') {
        failures.push({ code: 'E_GATES', detail: `check ${c?.id} has extra properties` });
      }
      if (!['READY', 'HOLD'].includes(c?.status)) {
        failures.push({ code: 'E_GATES', detail: `check ${c?.id} has invalid status` });
      }
    }
  }

  if (!doc?.residual || doc.residual.coneOk !== true) {
    failures.push({ code: 'CONE', detail: 'residual missing or coneOk !== true' });
  }
  const residual = doc?.residual;
  if (residual) {
    const S = residual.S;
    if (!Number.isFinite(S) || S < 0 || S > 0.25) {
      failures.push({ code: 'RESIDUAL_DOMAIN', detail: 'S must be finite and within [0, 0.25]' });
    } else {
      if (!Number.isFinite(residual.logCoord) || Math.abs(residual.logCoord - 4 * S) > 1e-12) {
        failures.push({ code: 'RESIDUAL_CONSISTENCY', detail: 'logCoord does not match S' });
      }
      if (!Number.isFinite(residual.n) || Math.abs(residual.n - (8 - 4 * S)) > 1e-12) {
        failures.push({ code: 'RESIDUAL_CONSISTENCY', detail: 'n does not match S' });
      }
      if (!Number.isFinite(residual.psi) || Math.abs(residual.psi - (CONE + S)) > 1e-12) {
        failures.push({ code: 'RESIDUAL_CONSISTENCY', detail: 'psi does not match S and cone constant' });
      }
      if (!Number.isFinite(residual.cone) || Math.abs(residual.cone - CONE) > 1e-12) {
        failures.push({ code: 'RESIDUAL_CONSISTENCY', detail: 'cone constant mismatch' });
      }
    }
  }

  const { signature, digest, keyId: docKeyId, note: _n, ...body } = doc || {};
  const payload = canonicalJson(body);
  const expectedDigest = sha256Hex(payload);
  if (digest !== expectedDigest) {
    failures.push({ code: 'DIGEST', detail: 'digest mismatch' });
  }

  if (requireSignature) {
    if (!publicKeyPem || !keyId) {
      failures.push({ code: 'SIGNATURE', detail: 'public key / keyId not configured' });
    } else if (!signature || docKeyId !== keyId) {
      failures.push({ code: 'SIGNATURE', detail: 'missing signature or keyId mismatch' });
    } else {
      try {
        const key = createPublicKey(publicKeyPem);
        const ok = verify(null, Buffer.from(payload, 'utf8'), key, Buffer.from(signature, 'base64'));
        if (!ok) failures.push({ code: 'SIGNATURE', detail: 'verification failed' });
      } catch (err) {
        failures.push({ code: 'SIGNATURE', detail: err.message });
      }
    }
  }

  return {
    valid: failures.length === 0,
    failures,
    residual: doc?.residual ?? null,
    namespace: 'E',
    productionClaimed: false,
  };
}

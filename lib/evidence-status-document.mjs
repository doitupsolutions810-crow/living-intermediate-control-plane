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
import { residualSnapshot, CONE, isValidResidualCoordinate } from './great-scale-residual.mjs';
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
  authority = 'local',
  ttlMs = DEFAULT_TTL_MS,
  extra = {},
} = {}) {
  // v5.4.0 is a closed signed contract. An arbitrary extension object here
  // could overwrite authority, schema, namespaces, residual, or gate results
  // before signing. There are no supported extension fields in this version.
  if (!extra || typeof extra !== 'object' || Array.isArray(extra) || Object.keys(extra).length > 0) {
    throw new TypeError('extra is not supported by the closed v5.4.0 evidence-status contract.');
  }

  const now = Date.now();
  const generatedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();
  const residual = residualSnapshot({ S, tau, roleBlock });

  const checks = contractChecks || EVIDENCE_GATES.map(id => ({
    id,
    status: residual.coneOk ? 'READY' : 'HOLD',
  }));

  // Exact E0–E6, no extra properties on check items
  const residualCoordinateValid = isValidResidualCoordinate(residual.S) && residual.coneOk === true;
  const normalizedChecks = checks.map(c => ({
    id: c.id,
    // Explicit caller assertions cannot make evidence ready when its residual
    // coordinate is invalid or outside the topology-derived domain.
    status: residualCoordinateValid && c.status === 'READY' ? 'READY' : 'HOLD',
  }));

  const doc = {
    schema: SCHEMA,
    version: '5.4.0',
    generatedAt,
    expiresAt,
    authority,
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
  // Notes are diagnostic and intentionally excluded from the signed contract.
  // Never include caller-provided note text in the digest/signature payload.
  const { signature: _drop, digest: _d, keyId: _k, note: _n, ...body } = doc;
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

function parseStrictTimestamp(value) {
  const pattern = /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/;
  if (typeof value !== 'string' || !pattern.test(value)) return NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return NaN;
  const datePart = value.slice(0, 10);
  const calendarDate = Date.parse(datePart + 'T00:00:00.000Z');
  if (!Number.isFinite(calendarDate) ||
      new Date(calendarDate).toISOString().slice(0, 10) !== datePart) return NaN;
  return parsed;
}

export function verifyEvidenceStatusDocument(doc, {
  publicKeyPem = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM || '',
  keyId = process.env.EVIDENCE_SOURCE_KEY_ID || '',
  now = Date.now(),
  requireSignature = true,
} = {}) {
  const failures = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return {
      valid: false,
      failures: [{ code: 'DOCUMENT_SHAPE', detail: 'document must be an object' }],
      residual: null,
      namespace: 'E',
      productionClaimed: false,
    };
  }

  const requiredDocumentKeys = [
    'schema', 'version', 'generatedAt', 'expiresAt', 'authority',
    'residual', 'contractChecks', 'namespaces', 'digest', 'keyId', 'signature',
  ];
  const allowedDocumentKeys = new Set([...requiredDocumentKeys, 'note']);
  const actualDocumentKeys = Object.keys(doc);
  if (requiredDocumentKeys.some(key => !Object.hasOwn(doc, key)) ||
      actualDocumentKeys.some(key => !allowedDocumentKeys.has(key))) {
    failures.push({ code: 'DOCUMENT_FIELDS', detail: 'document has missing or unsupported top-level fields' });
  }
  if (doc.schema !== SCHEMA || doc.version !== '5.4.0') {
    failures.push({ code: 'SCHEMA', detail: 'missing or wrong schema/version' });
  }
  if (!['local', 'public'].includes(doc.authority)) {
    failures.push({ code: 'AUTHORITY', detail: 'authority must be local or public' });
  }
  const namespaces = doc.namespaces;
  if (!namespaces || typeof namespaces !== 'object' || Array.isArray(namespaces) ||
      JSON.stringify(Object.keys(namespaces).sort()) !== JSON.stringify(['evidence', 'independent', 'production']) ||
      namespaces.evidence !== 'E0-E6' ||
      namespaces.production !== 'G0-G6' ||
      namespaces.independent !== true) {
    failures.push({ code: 'NAMESPACE', detail: 'namespace declaration must preserve independent E0-E6 and G0-G6 scopes' });
  }
  if (Object.hasOwn(doc, 'note') && typeof doc.note !== 'string') {
    failures.push({ code: 'NOTE', detail: 'diagnostic note must be a string when present' });
  }

  if (!Number.isFinite(now)) {
    failures.push({ code: 'FRESHNESS', detail: 'verification clock must be finite' });
  }
  const gen = parseStrictTimestamp(doc.generatedAt);
  const exp = parseStrictTimestamp(doc.expiresAt);
  if (!Number.isFinite(gen) || !Number.isFinite(exp)) {
    failures.push({ code: 'FRESHNESS', detail: 'generatedAt/expiresAt must be strict RFC3339 timestamps' });
  } else {
    if (exp <= gen || exp - gen > DEFAULT_TTL_MS) {
      failures.push({ code: 'FRESHNESS', detail: 'document lifetime must be positive and no longer than the configured maximum TTL' });
    }
    if (now > exp) failures.push({ code: 'FRESHNESS', detail: 'document expired' });
    if (gen > now + 5000) failures.push({ code: 'FRESHNESS', detail: 'generatedAt in the future' });
    if (now - gen > DEFAULT_TTL_MS) failures.push({ code: 'FRESHNESS', detail: 'document stale' });
  }

  const checks = doc.contractChecks;
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
        failures.push({ code: 'E_GATES', detail: `check ${c?.id} has an unsupported status` });
      }
    }
  }

  const residual = doc.residual;
  const residualKeys = ['S', 'cone', 'coneOk', 'logCoord', 'n', 'psi', 'role', 'roleBlock'];
  if (!residual || typeof residual !== 'object' || Array.isArray(residual) ||
      JSON.stringify(Object.keys(residual).sort()) !== JSON.stringify(residualKeys.slice().sort())) {
    failures.push({ code: 'RESIDUAL_SHAPE', detail: 'residual must contain exactly the v5.4.0 residual fields' });
  }
  if (!residual || residual.coneOk !== true) {
    failures.push({ code: 'CONE', detail: 'residual missing or coneOk !== true' });
  }
  if (!isValidResidualCoordinate(residual?.S)) {
    failures.push({ code: 'RESIDUAL_DOMAIN', detail: 'residual S must be finite and within [0, 0.25]' });
  } else if (![null, 1, 3, 4].includes(residual.roleBlock)) {
    failures.push({ code: 'RESIDUAL_BINDING', detail: 'roleBlock must be null or one of the defined partition blocks' });
  } else {
    const expectedResidual = residualSnapshot({ S: residual.S, roleBlock: residual.roleBlock });
    const numericFields = ['logCoord', 'n', 'psi', 'cone'];
    for (const field of numericFields) {
      if (typeof residual[field] !== 'number' || !Number.isFinite(residual[field]) ||
          Math.abs(residual[field] - expectedResidual[field === 'cone' ? 'CONE' : field]) > 1e-12) {
        failures.push({ code: 'RESIDUAL_BINDING', detail: `residual ${field} does not match the canonical value for S` });
      }
    }
    if (residual.coneOk !== expectedResidual.coneOk ||
        residual.role !== expectedResidual.role ||
        residual.roleBlock !== expectedResidual.roleBlock) {
      failures.push({ code: 'RESIDUAL_BINDING', detail: 'residual cone/role fields do not match the canonical coordinate' });
    }
  }

  const { signature, digest, keyId: docKeyId, note: _n, ...body } = doc;
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

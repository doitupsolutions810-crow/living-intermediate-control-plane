import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

/**
 * Evidence-envelope v1 semantic verifier.
 *
 * JSON Schema validation should run before this verifier. This module adds
 * cryptographic and policy checks that JSON Schema cannot establish.
 * A production replayGuard MUST be durable and atomic across all consumers.
 */

export function canonicalEvidenceJson(value) {
  function normalize(input) {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      const output = {};
      for (const key of Object.keys(input).sort()) {
        if (input[key] === undefined) throw new TypeError("undefined is not canonical evidence data");
        output[key] = normalize(input[key]);
      }
      return output;
    }
    if (typeof input === "number" && !Number.isFinite(input)) {
      throw new TypeError("non-finite numbers are not canonical evidence data");
    }
    return input;
  }
  return JSON.stringify(normalize(value));
}

function signedPayload(envelope) {
  const copy = structuredClone(envelope);
  if (!copy?.signature || typeof copy.signature !== "object") {
    throw new TypeError("signature object is required");
  }
  delete copy.signature.value;
  return canonicalEvidenceJson(copy);
}

export function signEvidenceEnvelope(envelope, { privateKeyPem, keyId } = {}) {
  if (!privateKeyPem || !keyId) throw new TypeError("privateKeyPem and keyId are required");
  const unsigned = structuredClone(envelope);
  unsigned.authority = { ...unsigned.authority, key_id: keyId };
  unsigned.signature = { algorithm: "Ed25519", value: "pending" };
  const payload = signedPayload(unsigned);
  const key = createPrivateKey(privateKeyPem);
  const signature = sign(null, Buffer.from(payload, "utf8"), key).toString("base64");
  return { ...unsigned, signature: { algorithm: "Ed25519", value: signature } };
}

function parseTime(value) {
  if (typeof value !== "string") return NaN;
  return Date.parse(value);
}

export async function verifyEvidenceEnvelope(envelope, {
  trustedKeys = {},
  expectedSubject = null,
  expectedPolicy = null,
  now = Date.now(),
  clockSkewMs = 5000,
  maxLifetimeMs = 24 * 60 * 60 * 1000,
  replayGuard = null,
  requireReplayProtection = true,
  allowedAlgorithms = ["Ed25519"],
} = {}) {
  const failures = [];
  const fail = (code, detail) => failures.push({ code, detail });

  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { valid: false, status: "NOT_VERIFIED", failures: [{ code: "SHAPE", detail: "envelope must be an object" }] };
  }

  if (envelope.schema !== "control-plane.evidence-envelope/v1") {
    fail("SCHEMA", "missing or unsupported evidence envelope schema");
  }
  if (!envelope.evidence_id || !envelope.request_id) {
    fail("IDENTITY", "evidence_id and request_id are required");
  }
  if (!["execution", "test", "build", "supply_chain", "policy"].includes(envelope.evidence_type)) {
    fail("EVIDENCE_TYPE", "unsupported evidence_type");
  }
  const statuses = ["PASS", "DEGRADED", "FAIL", "NOT_RUN", "NOT_VERIFIED"];
  if (!statuses.includes(envelope.claim?.status)) fail("CLAIM_STATUS", "unsupported claim status");
  if (!["real", "simulation", "static_analysis", "not_applicable"].includes(envelope.execution?.mode)) {
    fail("EXECUTION_MODE", "unsupported execution mode");
  }
  if (envelope.execution?.mode === "simulation" && envelope.claim?.status === "PASS") {
    fail("SIMULATION_CANNOT_PASS", "simulation is not evidence of successful real execution");
  }
  if (envelope.execution?.mode === "real" && !envelope.execution?.worker_receipt_id) {
    fail("WORKER_RECEIPT", "real execution requires a worker receipt identifier");
  }

  const subject = envelope.subject;
  if (!subject?.repository || !/^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(subject?.revision || "") ||
      !/^sha256:[a-fA-F0-9]{64}$/.test(subject?.artifact_digest || "")) {
    fail("SUBJECT_SHAPE", "repository, full commit revision, and sha256 artifact digest are required");
  }
  if (expectedSubject) {
    for (const field of ["repository", "revision", "artifact_digest"]) {
      if (expectedSubject[field] !== undefined && subject?.[field] !== expectedSubject[field]) {
        fail("SUBJECT_MISMATCH", `${field} does not match the evaluated candidate`);
      }
    }
  }
  if (expectedPolicy) {
    if (envelope.policy?.policy_id !== expectedPolicy.policy_id ||
        envelope.policy?.policy_version !== expectedPolicy.policy_version) {
      fail("POLICY_MISMATCH", "policy id/version does not match the receiving gate");
    }
  }

  const issued = parseTime(envelope.issued_at);
  const expires = parseTime(envelope.expires_at);
  const started = parseTime(envelope.execution?.started_at);
  const completed = envelope.execution?.completed_at == null ? null : parseTime(envelope.execution.completed_at);
  if (![issued, expires, started].every(Number.isFinite) ||
      (envelope.execution?.completed_at != null && !Number.isFinite(completed))) {
    fail("FRESHNESS", "issued, expiry, and execution timestamps must be valid date-time strings");
  } else {
    if (issued > now + clockSkewMs) fail("FRESHNESS", "evidence issue time is in the future");
    if (expires <= now) fail("FRESHNESS", "evidence has expired");
    if (expires <= issued) fail("FRESHNESS", "expiry must be later than issue time");
    if (expires - issued > maxLifetimeMs) fail("FRESHNESS", "evidence lifetime exceeds policy maximum");
    if (started > now + clockSkewMs) fail("FRESHNESS", "execution start time is in the future");
    if (completed !== null && completed < started) fail("TIMELINE", "execution completion precedes start");
    if (completed !== null && completed > now + clockSkewMs) fail("TIMELINE", "execution completion is in the future");
  }

  const authority = envelope.authority;
  const signature = envelope.signature;
  if (!["public", "local", "signed_internal"].includes(authority?.class) ||
      !authority?.issuer || !authority?.key_id) {
    fail("AUTHORITY", "authority class, issuer, and key id are required");
  }
  if (!signature?.algorithm || !signature?.value || !allowedAlgorithms.includes(signature.algorithm)) {
    fail("SIGNATURE", "signature algorithm is unsupported or signature is missing");
  }

  let payload = null;
  let payloadDigest = null;
  let trusted = null;
  if (authority?.key_id) {
    trusted = trustedKeys instanceof Map ? trustedKeys.get(authority.key_id) : trustedKeys[authority.key_id];
    if (!trusted) {
      fail("UNKNOWN_KEY", "authority key id is not trusted");
    } else {
      if (trusted.issuer !== authority.issuer) fail("ISSUER_MISMATCH", "key is not trusted for the declared issuer");
      if (Array.isArray(trusted.evidenceTypes) && !trusted.evidenceTypes.includes(envelope.evidence_type)) {
        fail("ISSUER_SCOPE", "issuer is not authorized for this evidence type");
      }
      if (Array.isArray(trusted.repositories) && !trusted.repositories.includes(subject?.repository)) {
        fail("ISSUER_SCOPE", "issuer is not authorized for this repository");
      }
      if (Array.isArray(trusted.authorityClasses) && !trusted.authorityClasses.includes(authority.class)) {
        fail("AUTHORITY_SCOPE", "key is not authorized for this authority class");
      }
      try {
        payload = signedPayload(envelope);
        payloadDigest = createHash("sha256").update(payload, "utf8").digest("hex");
        if (signature?.algorithm === "Ed25519" && trusted.publicKeyPem) {
          const key = createPublicKey(trusted.publicKeyPem);
          const ok = verify(null, Buffer.from(payload, "utf8"), key, Buffer.from(signature.value, "base64"));
          if (!ok) fail("SIGNATURE_INVALID", "Ed25519 signature verification failed");
        } else {
          fail("SIGNATURE_KEY", "trusted Ed25519 public key is unavailable");
        }
      } catch (error) {
        fail("SIGNATURE_INVALID", `signature verification could not complete: ${error.message}`);
      }
    }
  }

  if (requireReplayProtection && typeof replayGuard !== "function") {
    fail("REPLAY_GUARD_UNAVAILABLE", "a durable atomic replay guard is required");
  } else if (typeof replayGuard === "function" && payloadDigest && failures.length === 0) {
    try {
      const firstUse = await replayGuard({
        requestId: envelope.request_id,
        evidenceId: envelope.evidence_id,
        digest: payloadDigest,
      });
      if (firstUse !== true) fail("REPLAY", "request/evidence identity was already used or could not be claimed");
    } catch (error) {
      fail("REPLAY_GUARD_UNAVAILABLE", `replay guard failed closed: ${error.message}`);
    }
  }

  return {
    valid: failures.length === 0,
    status: failures.length === 0 ? envelope.claim.status : "NOT_VERIFIED",
    failures,
    evidenceId: envelope.evidence_id ?? null,
    requestId: envelope.request_id ?? null,
    payloadDigest,
    productionAuthorized: false,
    note: "Envelope verification is evidence validation only; the receiving policy gate must make the authorization decision.",
  };
}

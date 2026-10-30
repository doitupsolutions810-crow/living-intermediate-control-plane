import { generateKeyPairSync } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { signEvidenceEnvelope, verifyEvidenceEnvelope } from "../lib/evidence-envelope-v1.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
const keyId = "test-evidence-key";
const now = Date.parse("2026-10-27T00:00:30.000Z");
const trustedKeys = {
  [keyId]: {
    issuer: "test-worker",
    publicKeyPem,
    evidenceTypes: ["execution"],
    repositories: ["example/worker"],
    authorityClasses: ["signed_internal"],
  },
};
const expectedSubject = {
  repository: "example/worker",
  revision: "a".repeat(40),
  artifact_digest: "sha256:" + "b".repeat(64),
};
const expectedPolicy = { policy_id: "release-gate", policy_version: "v1" };

function makeEnvelope(overrides = {}) {
  const base = {
    schema: "control-plane.evidence-envelope/v1",
    evidence_id: "evidence-1",
    evidence_type: "execution",
    claim: { status: "PASS", summary: "Worker completed and returned receipt." },
    subject: { ...expectedSubject },
    execution: {
      mode: "real",
      worker_receipt_id: "receipt-1",
      started_at: "2026-10-27T00:00:01.000Z",
      completed_at: "2026-10-27T00:00:10.000Z",
    },
    authority: { class: "signed_internal", issuer: "test-worker", key_id: keyId },
    policy: { ...expectedPolicy },
    issued_at: "2026-10-27T00:00:00.000Z",
    expires_at: "2026-10-27T00:01:00.000Z",
    request_id: "request-1",
    signature: { algorithm: "Ed25519", value: "placeholder" },
  };
  const merged = {
    ...base,
    ...overrides,
    claim: overrides.claim ?? base.claim,
    subject: overrides.subject ?? base.subject,
    execution: overrides.execution ?? base.execution,
    authority: overrides.authority ?? base.authority,
    policy: overrides.policy ?? base.policy,
    signature: overrides.signature ?? base.signature,
  };
  return signEvidenceEnvelope(merged, { privateKeyPem, keyId });
}

function guardOnce() {
  const seen = new Set();
  return async ({ requestId, evidenceId, digest }) => {
    const key = requestId + ":" + evidenceId + ":" + digest;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}

const options = (replayGuard = guardOnce(), overrides = {}) => ({
  trustedKeys,
  expectedSubject,
  expectedPolicy,
  now,
  replayGuard,
  ...overrides,
});

test("accepts a valid signed envelope bound to expected subject and policy", async () => {
  const result = await verifyEvidenceEnvelope(makeEnvelope(), options());
  assert.equal(result.valid, true, JSON.stringify(result.failures));
  assert.equal(result.status, "PASS");
  assert.equal(result.productionAuthorized, false);
});

test("rejects simulation presented as PASS", async () => {
  const envelope = makeEnvelope({
    claim: { status: "PASS", summary: "simulation" },
    execution: { mode: "simulation", started_at: "2026-10-27T00:00:01.000Z", completed_at: "2026-10-27T00:00:10.000Z" },
  });
  const result = await verifyEvidenceEnvelope(envelope, options());
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.code === "SIMULATION_CANNOT_PASS"));
});

test("rejects real execution without worker receipt", async () => {
  const envelope = makeEnvelope({
    execution: { mode: "real", started_at: "2026-10-27T00:00:01.000Z", completed_at: "2026-10-27T00:00:10.000Z" },
  });
  const result = await verifyEvidenceEnvelope(envelope, options());
  assert.ok(result.failures.some(f => f.code === "WORKER_RECEIPT"));
});

test("rejects artifact or revision mismatch", async () => {
  const result = await verifyEvidenceEnvelope(makeEnvelope(), options(guardOnce(), {
    expectedSubject: { ...expectedSubject, revision: "c".repeat(40) },
  }));
  assert.ok(result.failures.some(f => f.code === "SUBJECT_MISMATCH"));
});

test("rejects expired evidence", async () => {
  const envelope = signEvidenceEnvelope({
    ...makeEnvelope(),
    expires_at: "2026-10-27T00:00:20.000Z",
    signature: { algorithm: "Ed25519", value: "placeholder" },
  }, { privateKeyPem, keyId });
  const result = await verifyEvidenceEnvelope(envelope, { ...options(), now });
  assert.ok(result.failures.some(f => f.code === "FRESHNESS"));
});

test("rejects a tampered payload", async () => {
  const envelope = makeEnvelope();
  envelope.claim.summary = "tampered after signing";
  const result = await verifyEvidenceEnvelope(envelope, options());
  assert.ok(result.failures.some(f => f.code === "SIGNATURE_INVALID"));
});

test("fails closed when replay protection is not configured", async () => {
  const result = await verifyEvidenceEnvelope(makeEnvelope(), {
    trustedKeys, expectedSubject, expectedPolicy, now,
  });
  assert.ok(result.failures.some(f => f.code === "REPLAY_GUARD_UNAVAILABLE"));
});

test("rejects reuse of a request/evidence identity", async () => {
  const envelope = makeEnvelope();
  const guard = guardOnce();
  const opts = options(guard);
  const first = await verifyEvidenceEnvelope(envelope, opts);
  const second = await verifyEvidenceEnvelope(envelope, opts);
  assert.equal(first.valid, true);
  assert.ok(second.failures.some(f => f.code === "REPLAY"));
});

test("rejects issuer mismatch even with a known key", async () => {
  const envelope = makeEnvelope({ authority: { class: "signed_internal", issuer: "imposter", key_id: keyId } });
  const result = await verifyEvidenceEnvelope(envelope, options());
  assert.ok(result.failures.some(f => f.code === "ISSUER_MISMATCH"));
});

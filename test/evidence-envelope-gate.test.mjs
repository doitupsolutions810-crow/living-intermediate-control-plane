import { generateKeyPairSync } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { signEvidenceEnvelope } from "../lib/evidence-envelope-v1.mjs";
import { evaluateProductionAuthorizationWithEnvelope } from "../lib/evidence-envelope-gate.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
const keyId = "supply-chain-test-key";
const now = Date.parse("2026-10-27T00:00:30.000Z");
const subject = {
  repository: "example/release",
  revision: "d".repeat(40),
  artifact_digest: "sha256:" + "e".repeat(64),
};
const policy = { policy_id: "production-release", policy_version: "v1" };
const trustedKeys = {
  [keyId]: {
    issuer: "supply-chain-authority",
    publicKeyPem,
    evidenceTypes: ["supply_chain"],
    repositories: ["example/release"],
    authorityClasses: ["signed_internal", "local"],
  },
};

function envelope(authorityClass = "signed_internal") {
  const base = {
    schema: "control-plane.evidence-envelope/v1",
    evidence_id: "sc-evidence-1",
    evidence_type: "supply_chain",
    claim: { status: "PASS", summary: "Supply-chain checks completed." },
    subject: { ...subject },
    execution: {
      mode: "not_applicable",
      started_at: "2026-10-27T00:00:01.000Z",
      completed_at: "2026-10-27T00:00:10.000Z",
    },
    authority: { class: authorityClass, issuer: "supply-chain-authority", key_id: keyId },
    policy: { ...policy },
    issued_at: "2026-10-27T00:00:00.000Z",
    expires_at: "2026-10-27T00:01:00.000Z",
    request_id: "sc-request-1",
    signature: { algorithm: "Ed25519", value: "placeholder" },
  };
  return signEvidenceEnvelope(base, { privateKeyPem, keyId });
}

const baseOptions = {
  expectedSubject: subject,
  expectedPolicy: policy,
  verificationOptions: {
    trustedKeys,
    now,
    replayGuard: async () => true,
  },
  coreReady: true,
  S: 0.05,
};

test("valid signed supply-chain evidence reaches the production policy gate", async () => {
  const result = await evaluateProductionAuthorizationWithEnvelope({
    ...baseOptions,
    supplyChainEnvelope: envelope(),
  });
  assert.equal(result.evidenceAccepted, true, JSON.stringify(result.evidenceVerification.failures));
  assert.equal(result.production.supplyChainOk, true);
  assert.equal(result.evidenceVerification.productionAuthorized, false);
});

test("local evidence never satisfies production supply-chain evidence", async () => {
  const result = await evaluateProductionAuthorizationWithEnvelope({
    ...baseOptions,
    supplyChainEnvelope: envelope("local"),
  });
  assert.equal(result.evidenceVerification.valid, true);
  assert.equal(result.evidenceAccepted, false);
  assert.equal(result.production.supplyChainOk, false);
  assert.equal(result.productionAuthorized, false);
});

test("missing expected subject or policy fails closed", async () => {
  const result = await evaluateProductionAuthorizationWithEnvelope({
    coreReady: true,
    supplyChainEnvelope: envelope(),
    verificationOptions: baseOptions.verificationOptions,
  });
  assert.equal(result.evidenceAccepted, false);
  assert.ok(result.evidenceVerification.failures.some(f => f.code === "EXPECTED_BINDING_REQUIRED"));
  assert.equal(result.productionAuthorized, false);
});

test("partial expected subject fails closed instead of leaving revision and artifact unbound", async () => {
  const result = await evaluateProductionAuthorizationWithEnvelope({
    ...baseOptions,
    expectedSubject: { repository: subject.repository },
    supplyChainEnvelope: envelope(),
  });
  assert.equal(result.evidenceAccepted, false);
  assert.ok(result.evidenceVerification.failures.some(f => f.code === "EXPECTED_BINDING_REQUIRED"));
  assert.equal(result.production.supplyChainOk, false);
  assert.equal(result.productionAuthorized, false);
});

test("malformed expected revision or artifact digest fails closed", async () => {
  for (const expectedSubject of [
    { ...subject, revision: "main" },
    { ...subject, artifact_digest: "sha256:invalid" },
  ]) {
    const result = await evaluateProductionAuthorizationWithEnvelope({
      ...baseOptions,
      expectedSubject,
      supplyChainEnvelope: envelope(),
    });
    assert.equal(result.evidenceAccepted, false);
    assert.ok(result.evidenceVerification.failures.some(f => f.code === "EXPECTED_BINDING_REQUIRED"));
    assert.equal(result.productionAuthorized, false);
  }
});

test("partial expected policy fails closed", async () => {
  const result = await evaluateProductionAuthorizationWithEnvelope({
    ...baseOptions,
    expectedPolicy: { policy_id: policy.policy_id },
    supplyChainEnvelope: envelope(),
  });
  assert.equal(result.evidenceAccepted, false);
  assert.ok(result.evidenceVerification.failures.some(f => f.code === "EXPECTED_BINDING_REQUIRED"));
  assert.equal(result.productionAuthorized, false);
});

test("subject mismatch prevents supply-chain evidence acceptance", async () => {
  const result = await evaluateProductionAuthorizationWithEnvelope({
    ...baseOptions,
    expectedSubject: { ...subject, artifact_digest: "sha256:" + "f".repeat(64) },
    supplyChainEnvelope: envelope(),
  });
  assert.equal(result.evidenceAccepted, false);
  assert.ok(result.evidenceVerification.failures.some(f => f.code === "SUBJECT_MISMATCH"));
  assert.equal(result.production.supplyChainOk, false);
});

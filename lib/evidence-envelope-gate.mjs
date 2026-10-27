import { evaluateProductionAuthorization } from "./gate-namespaces.mjs";
import { verifyEvidenceEnvelope } from "./evidence-envelope-v1.mjs";

/**
 * Production-gate adapter for signed supply-chain evidence.
 *
 * This is additive: the existing synchronous gate API remains unchanged.
 * The adapter fails closed unless callers bind evidence to an expected subject
 * and policy and supply trusted keys plus a durable atomic replay guard.
 */
export async function evaluateProductionAuthorizationWithEnvelope({
  coreReady = false,
  supplyChainEnvelope = null,
  expectedSubject = null,
  expectedPolicy = null,
  verificationOptions = {},
  env = process.env,
  config = {},
  S = 0,
  requireCone = true,
} = {}) {
  const failures = [];
  const expectedSubjectIsComplete =
    expectedSubject !== null &&
    typeof expectedSubject === "object" &&
    !Array.isArray(expectedSubject) &&
    typeof expectedSubject.repository === "string" &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(expectedSubject.repository) &&
    typeof expectedSubject.revision === "string" &&
    /^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(expectedSubject.revision) &&
    typeof expectedSubject.artifact_digest === "string" &&
    /^sha256:[a-fA-F0-9]{64}$/.test(expectedSubject.artifact_digest);
  const expectedPolicyIsComplete =
    expectedPolicy !== null &&
    typeof expectedPolicy === "object" &&
    !Array.isArray(expectedPolicy) &&
    typeof expectedPolicy.policy_id === "string" &&
    expectedPolicy.policy_id.trim().length > 0 &&
    typeof expectedPolicy.policy_version === "string" &&
    expectedPolicy.policy_version.trim().length > 0;

  if (!expectedSubjectIsComplete || !expectedPolicyIsComplete) {
    failures.push({
      code: "EXPECTED_BINDING_REQUIRED",
      detail: "a complete expectedSubject (repository, full revision, and artifact digest) and expectedPolicy (policy id and version) are required for production evidence evaluation",
    });
  }

  let evidenceVerification = {
    valid: false,
    status: "NOT_VERIFIED",
    failures: [...failures],
    productionAuthorized: false,
  };

  if (failures.length === 0) {
    evidenceVerification = await verifyEvidenceEnvelope(supplyChainEnvelope, {
      ...verificationOptions,
      expectedSubject,
      expectedPolicy,
      requireReplayProtection: true,
    });
  }

  const supplyChainOk =
    evidenceVerification.valid === true &&
    supplyChainEnvelope?.evidence_type === "supply_chain" &&
    supplyChainEnvelope?.claim?.status === "PASS" &&
    supplyChainEnvelope?.authority?.class !== "local";

  const production = evaluateProductionAuthorization({
    coreReady,
    supplyChainOk,
    env,
    config,
    S,
    requireCone,
  });

  return {
    schema: "great-scale.production-envelope-gate/v1",
    evidenceAccepted: supplyChainOk,
    evidenceVerification,
    production,
    productionAuthorized: production.productionAuthorized,
    note: supplyChainOk
      ? production.note
      : "Production denied: a valid, non-local, PASS supply-chain envelope bound to the exact subject and policy is required.",
  };
}

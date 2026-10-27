# Cross-Repository Evidence Envelope v1 (Proposed Contract)

Status: **proposal; not yet implemented or adopted by all producers and consumers**.

This contract is intended to connect Trinity Core, Swarm VM Runner, Capability Authority / Capability Plane, and the Living Intermediate Control Plane without conflating execution claims, evidence authority, procurement readiness, or production authorization.

## 1. Non-negotiable invariants

1. **No success by simulation.** A simulated or local fallback execution is never evidence of real worker execution.
2. **No authority by reachability.** A reachable endpoint is not, by itself, valid evidence; a timeout or missing endpoint is not positive evidence.
3. **No implicit trust in local evidence.** Local evidence is accepted only under an explicit policy opt-in and must remain labeled local.
4. **No cross-namespace promotion.** Procurement readiness (E0–E6) does not imply production authorization (G0–G6).
5. **No revision drift.** Evidence must identify the immutable source revision and artifact digest it describes.
6. **No replay or silent downgrade.** Consumers must reject expired evidence, duplicate request identities with conflicting payloads, unsupported schema versions, and invalid signatures.
7. **Unknown is not success.** Missing, malformed, unverifiable, stale, or contradictory evidence evaluates to `NOT_VERIFIED`, never `PASS`.

## 2. Proposed envelope

The following JSON shape is normative for the proposal. Fields marked required must be present and validated before a consumer may use the evidence.

```json
{
  "schema": "control-plane.evidence-envelope/v1",
  "evidence_id": "unique-immutable-id",
  "evidence_type": "execution | test | build | supply_chain | policy",
  "claim": {
    "status": "PASS | DEGRADED | FAIL | NOT_RUN | NOT_VERIFIED",
    "summary": "bounded human-readable description"
  },
  "subject": {
    "repository": "owner/repository",
    "revision": "full immutable commit SHA",
    "artifact_digest": "sha256:<hex>",
    "workflow_run_id": "optional platform run identity",
    "job_id": "optional platform job identity"
  },
  "execution": {
    "mode": "real | simulation | static_analysis | not_applicable",
    "worker_receipt_id": "required for real execution claims",
    "started_at": "RFC3339 UTC timestamp",
    "completed_at": "RFC3339 UTC timestamp or null"
  },
  "authority": {
    "class": "public | local | signed_internal",
    "issuer": "stable issuer identity",
    "key_id": "verification key identifier or null"
  },
  "policy": {
    "policy_id": "stable policy identifier",
    "policy_version": "immutable policy version"
  },
  "issued_at": "RFC3339 UTC timestamp",
  "expires_at": "RFC3339 UTC timestamp",
  "request_id": "immutable idempotency / correlation identity",
  "signature": {
    "algorithm": "approved algorithm identifier",
    "value": "signature over canonical envelope excluding this value"
  }
}
```

The draft JSON Schema is `schemas/cross-repository-evidence-envelope-v1.schema.json`. A semantic verifier now exists at `lib/evidence-envelope-v1.mjs`; it uses Ed25519 and a sorted-key JSON serialization profile, validates trusted key/issuer scope, freshness, policy and subject binding, simulation/receipt rules, and an injected replay guard. It does not replace JSON Schema validation. The verifier is implemented in this repository only; current producers and other consumers are not claimed to emit or enforce this envelope.

## 3. Producer obligations

Every producer must:
- set `schema`, evidence identity, evidence type, immutable revision, artifact digest, issuer, issue time, expiry, and request identity;
- distinguish real execution from simulation and static checks;
- emit a worker receipt identifier only when a real worker receipt exists;
- sign the canonical envelope using an authorized issuer key;
- never convert timeout, unavailable service, empty result, or unknown state into success;
- preserve the original failure/degraded state when wrapping or forwarding evidence.

A gateway or aggregator may attach transport metadata but must not upgrade the producer's claim or authority.

## 4. Consumer obligations

Before using an envelope, a consumer must verify:
1. schema version is supported and required fields are well-formed;
2. signature algorithm and key ID are allowed, and the signature validates against a trusted key registry;
3. issuer is authorized for the evidence type and repository / execution scope;
4. current time is within the evidence validity interval, with an explicitly bounded clock-skew allowance;
5. source revision and artifact digest match the exact candidate being evaluated;
6. request ID / evidence ID has not been replayed with conflicting content;
7. execution mode is compatible with the requested gate;
8. the policy version is the version selected by the receiving gate.

Any failed or unknown check produces `NOT_VERIFIED` or a stricter denial state. Local fallback may support diagnostics or development only; it must not silently satisfy production evidence requirements.

## 5. Mapping to existing gate namespaces

| Existing concept | Contract treatment |
|---|---|
| Evidence-console `status=ok`, `authority=public` | Public evidence candidate; still validate schema, issuer, signature, freshness, revision, and digest |
| Explicit local-evidence opt-in | May permit `authority=local` for explicitly scoped non-production decisions; never upgrades it to public |
| E0–E6 procurement namespace | Consumes evidence for procurement readiness only |
| G0–G6 production namespace | Independently requires core readiness, supply-chain evidence, and cone compliance |
| `FORCE_PROCUREMENT` / diagnostic force flags | Metadata only; never authorizes |
| Trinity local four-role fallback | `execution.mode=simulation`, claim `DEGRADED`, no real worker receipt |
| Swarm coordinator job | Real-execution claim only after coordinator/worker receipt and terminal success are validated |

## 6. Minimum conformance test matrix

| Case | Expected result |
|---|---|
| Valid signature, current evidence, exact revision and digest, authorized issuer | Eligible for policy evaluation |
| Local evidence without explicit local opt-in | Deny |
| Local evidence presented to a production gate | Deny as production evidence |
| Simulated execution claims real worker success | Deny |
| Missing worker receipt for a real-execution claim | `NOT_VERIFIED` |
| Expired evidence | `NOT_VERIFIED` |
| Signature invalid or key unknown/revoked | Deny |
| Commit SHA or artifact digest differs from candidate | Deny |
| Unsupported schema or missing required field | `NOT_VERIFIED` |
| Timeout / missing endpoint / empty response | `NOT_VERIFIED`, never `PASS` |
| Same request ID reused with conflicting digest | Deny and emit audit event |
| Procurement ready but production gate fails | Procurement remains distinct; production denied |
| Diagnostic force flag set | No change to authorization result |

## 7. Adoption plan

1. Freeze this proposal and agree the field names, signature algorithm, canonicalization, key distribution, and status semantics.
2. Publish a formal JSON Schema and golden valid/invalid fixtures.
3. Implement a shared verifier library or identical conformance suite before converting producers.
4. Add the envelope to Capability Plane / Capability Authority issuance and receipt paths.
5. Update Swarm VM Runner and Trinity Core to preserve signed worker evidence and never synthesize receipts.
6. Add an adapter in Living Intermediate Control Plane; retain the independent E and G gate namespaces.
7. Require exact-head CI to run conformance fixtures and record its own envelope.
8. Roll out in observe-only mode first; reject production authorization until all required producers and consumers pass conformance.

## 8. Release criteria

The contract is **not production-ready** until:
- the JSON Schema and canonical signature profile are committed;
- producer and consumer implementations share the same golden fixtures;
- negative tests cover all rows in the matrix;
- exact-head CI passes;
- revision and artifact digest are verified end-to-end;
- live worker receipts are demonstrated without simulation fallback;
- the E/G namespace independence tests remain green.

No repository should claim end-to-end integration solely because this document exists.


## 9. Signature and verifier profile

- Signature algorithm: **Ed25519** only for v1.
- The signature payload is the complete envelope with only `signature.value` omitted. `signature.algorithm` and `authority.key_id` remain covered by the signature.
- Canonical serialization: recursively sort object keys lexicographically, preserve array order, serialize as compact ECMAScript JSON, encode as UTF-8, and reject undefined or non-finite numeric values. The v1 envelope intentionally uses no numeric fields.
- The verifier resolves `authority.key_id` through an injected trusted-key registry. Each key entry must bind the key to an issuer and may restrict evidence types, repositories, and authority classes.
- Replay protection is an injected callback because the production implementation must be durable and atomic across concurrent verifier instances. A process-local set is suitable only for unit tests, not production.
- The verifier returns `productionAuthorized: false` by design. Evidence verification is not the final authorization decision; the receiving G-namespace gate must still apply its own policy.
- The conformance fixtures use placeholder signature strings for structural schema testing only. They are not cryptographically signed examples and must never be accepted by the semantic verifier.

The executable security tests are in `test/evidence-envelope-v1.test.mjs`; schema fixtures are checked by `scripts/validate-evidence-envelope.mjs`. CI has been configured to run both, but hosted execution remains unverified until a run returns usable step results and a successful conclusion.

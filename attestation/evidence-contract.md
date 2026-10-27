# Evidence Console Contract Restoration (Issue #11)

## Required endpoints (v5.4.0)

- `GET /api/status` → HTTP 200 with:
  - version: "5.4.0"
  - runtime: "read-only-dynamic"
  - privacy: "local-only"
  - serverSideEvidenceStorage: false
  - syntheticEvidenceRejected: true
  - productionEvidenceClassRequired: true
  - requiredEvidenceClass: "production-acceptance"
  - requiredEnvironment: "production"
  - mandatoryGates: 7
  - exactly the seven **evidence-console contract-check IDs** `E0` through `E6`, each present once with status `READY`
  - overall: "READY"

- `GET /api/v1/evidence/schema` → matching JSON schema

- Source freshness fields required in the status document and its schema:
  - `sourceGeneratedAt`: source-generated ISO 8601 date-time, no more than five minutes old at decision time, allowing at most 30 seconds of future clock skew
  - `sourceExpiresAt`: source-generated ISO 8601 date-time, strictly later than the current time and `sourceGeneratedAt`, with a validity span no longer than five minutes
- `sourceIdentity`: the literal producer identity `control12-evidence-console`
- `sourceKeyId`: the identifier for the producer's Ed25519 signing key, pinned by the consumer independently
- `sourceEvidenceDigest`: SHA-256 of canonical status JSON with only `sourceEvidenceDigest` and `sourceSignature` omitted
- `sourceSignature`: Ed25519 signature over the newline-delimited tuple `sourceIdentity`, `sourceKeyId`, `sourceGeneratedAt`, `sourceExpiresAt`, and `sourceEvidenceDigest`
- The control-plane verifier must be configured with `EVIDENCE_SOURCE_KEY_ID` and `EVIDENCE_SOURCE_PUBLIC_KEY_PEM`. Missing configuration fails closed. The producer must hold `EVIDENCE_SOURCE_PRIVATE_KEY_PEM` only in its hosting environment; the private key must never be committed or sent to the consumer.
- The client-side `checkedAt` timestamp is diagnostic only and must not be used as evidence-source freshness. Because the contract identifies the runtime as `read-only-dynamic`, the producer must still renew the source timestamp from a real readiness observation at least within this five-minute window. A timestamp baked into a static artifact once at build/deploy time will become stale and must not keep authorizing procurement. If the producer cannot renew the observation, the correct result is a public-evidence hold.
- Missing or invalid timestamps, expired evidence, stale evidence, excessive lifetime, or a future generation time beyond clock-skew tolerance invalidate public authority. Until the public producer publishes the v5.4.0 contract, the probe fails closed; operators must not silently re-label the old v5.3.1 response as fresh.

## Action taken

A compliant production deployment was pushed to the existing `control12-evidence-console` Vercel project under Control704 override.

Once the build completes and the production alias serves the new routes, the procurement hold `HOLD_EVIDENCE_CONTROL` can be lifted.


## Procurement authority validation

An HTTP 200 response is reachability evidence only; it does not authorize procurement. The control-plane probe must fetch both `/api/status` and `/api/v1/evidence/schema` over HTTPS and validate them independently against the v5.4.0 contract. Each trust field must appear in the live status document, and the schema must independently require and constrain that field. The schema must require the exact `E0`–`E6` evidence-console contract-check set, constrain every check status to `READY`, and require the overall `READY` state. For an object-form contract-check map, `E0`–`E6` must all be required keys with each value fixed to `READY`, and `additionalProperties` must be `false`. For an array-form contract-check list, require exactly seven items, require `id` and `status` on each item, limit `id` to `E0`–`E6`, fix `status` to `READY`, and include a `contains` constraint with `minContains: 1` and `maxContains: 1` for each contract-check ID. The runtime validator independently rejects missing, duplicate, and unknown IDs. A claim missing from one document cannot be supplied by the other.

A local fallback remains a separate authority mode: it requires an observed degraded local-fallback state and explicit `ACCEPT_LOCAL_EVIDENCE=1` (or the equivalent explicit configuration). `FORCE_PROCUREMENT=1` is not evidence and cannot override the authorization predicate.

A successful contract test establishes only that the validator accepts its test fixture. It does not establish that the deployed public endpoints currently conform; that requires a live status/schema check and successful CI for the exact candidate.


## Freshness and residual trust limits

The v5.4.0 freshness fields prevent a previously valid status payload from being accepted indefinitely merely because it can still be fetched. They do **not** authenticate the producer or prove that every underlying event has been included. Source signature verification and a monotonic sequence/checkpoint remain distinct controls. A source that can forge its own timestamps can still make stale content appear fresh; freshness therefore counts only when the complete source status is digest-bound and the digest is signed by the independently pinned producer key. The source's `sourceIdentity`, key ID, times and digest are signed; a consumer-local `checkedAt` is never part of that trust claim.

The `E0`–`E6` identifiers mean only that the evidence console's own contract checks are satisfied. They are **not** the production readiness gates `G0`–`G6`; those retain their own authoritative production evaluator and can remain `NO_GO` while procurement trust is valid. The evidence console must not claim production gates are READY merely to make its trust contract pass.

The runtime must be `read-only-dynamic`: each request may report coarse producer/contract health, but it must not claim seven production gates passed, write evidence, or infer gate values from the schema. The source timestamp must be refreshed from the producer's current actual observation for each response, with an expiry no longer than five minutes. A static build-time timestamp is not compliant.

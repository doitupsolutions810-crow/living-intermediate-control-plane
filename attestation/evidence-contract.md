# Evidence Console Contract Restoration (Issue #11)

## Required endpoints (v5.4.0)

- `GET /api/status` → HTTP 200 with:
  - version: "5.4.0"
  - runtime: "static"
  - privacy: "local-only"
  - serverSideEvidenceStorage: false
  - syntheticEvidenceRejected: true
  - productionEvidenceClassRequired: true
  - requiredEvidenceClass: "production-acceptance"
  - requiredEnvironment: "production"
  - mandatoryGates: 7
  - exactly the seven gate IDs `G0` through `G6`, each present once with status `READY`
  - overall: "READY"

- `GET /api/v1/evidence/schema` → matching JSON schema

- Source freshness fields required in the status document and its schema:
  - `sourceGeneratedAt`: source-generated ISO 8601 date-time, no more than five minutes old at decision time, allowing at most 30 seconds of future clock skew
  - `sourceExpiresAt`: source-generated ISO 8601 date-time, strictly later than the current time and `sourceGeneratedAt`, with a validity span no longer than five minutes
- The client-side `checkedAt` timestamp is diagnostic only and must not be used as evidence-source freshness. Because the contract identifies the runtime as `static`, the producer must still renew the source timestamp from a real readiness observation at least within this five-minute window. A timestamp baked into a static artifact once at build/deploy time will become stale and must not keep authorizing procurement. If the producer cannot renew the observation, the correct result is a public-evidence hold.
- Missing or invalid timestamps, expired evidence, stale evidence, excessive lifetime, or a future generation time beyond clock-skew tolerance invalidate public authority. Until the public producer publishes the v5.4.0 contract, the probe fails closed; operators must not silently re-label the old v5.3.1 response as fresh.

## Action taken

A compliant production deployment was pushed to the existing `control12-evidence-console` Vercel project under Control704 override.

Once the build completes and the production alias serves the new routes, the procurement hold `HOLD_EVIDENCE_CONTROL` can be lifted.


## Procurement authority validation

An HTTP 200 response is reachability evidence only; it does not authorize procurement. The control-plane probe must fetch both `/api/status` and `/api/v1/evidence/schema` over HTTPS and validate them independently against the v5.4.0 contract. Each trust field must appear in the live status document, and the schema must independently require and constrain that field. The schema must require the exact `G0`–`G6` set, constrain every gate status to `READY`, and require the overall `READY` state. For an object-form gate map, `G0`–`G6` must all be required keys with each value fixed to `READY`, and `additionalProperties` must be `false`. For an array-form gate list, require exactly seven items, require `id` and `status` on each item, limit `id` to `G0`–`G6`, fix `status` to `READY`, and include a `contains` constraint with `minContains: 1` and `maxContains: 1` for each gate ID. The runtime validator independently rejects missing, duplicate, and unknown IDs. A claim missing from one document cannot be supplied by the other.

A local fallback remains a separate authority mode: it requires an observed degraded local-fallback state and explicit `ACCEPT_LOCAL_EVIDENCE=1` (or the equivalent explicit configuration). `FORCE_PROCUREMENT=1` is not evidence and cannot override the authorization predicate.

A successful contract test establishes only that the validator accepts its test fixture. It does not establish that the deployed public endpoints currently conform; that requires a live status/schema check and successful CI for the exact candidate.


## Freshness and residual trust limits

The v5.4.0 freshness fields prevent a previously valid status payload from being accepted indefinitely merely because it can still be fetched. They do **not** authenticate the producer or prove that every underlying event has been included. Source signature verification and a monotonic sequence/checkpoint remain distinct controls. A source that can forge its own timestamps can still make stale content appear fresh; a signed envelope or independently anchored checkpoint is required before treating freshness as authenticity or completeness.

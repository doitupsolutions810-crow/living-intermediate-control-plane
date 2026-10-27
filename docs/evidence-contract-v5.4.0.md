# Evidence contract v5.4.0 — rollout and acceptance gates

## Purpose

Public evidence is authorization-grade only when the payload and its JSON schema independently satisfy the v5.4.0 contract. HTTP success, a fresh client request, and a local fallback are not substitutes for source-issued freshness or authorization.

## Source-issued freshness

The public `/api/status` payload and the independently fetched `/api/v1/evidence/schema` must both require and constrain:

- `sourceGeneratedAt`: timezone-qualified ISO 8601 date-time; no more than five minutes old at decision time; at most 30 seconds of future clock skew.
- `sourceExpiresAt`: timezone-qualified ISO 8601 date-time; strictly later than decision time and generation time; validity span no longer than five minutes.

The client-generated `checkedAt` value is diagnostic only. It cannot refresh old source evidence. Because the contract labels the runtime `static`, the producer must renew these fields from a real readiness observation; timestamps baked once into a static build will expire and must stop authorizing procurement.

## Separate assurance dimensions

Freshness does not authenticate the producer and does not prove that the producer's underlying evidence is complete. Where the threat model requires source authenticity, use an independently verified signature/identity. Where omission or tail truncation matters, require a monotonic sequence/watermark and an independently anchored checkpoint. These are separate from the supply-chain report's Cosign attestation.

Local evidence may authorize only when the probe observed a recognized degraded state and explicit local-evidence opt-in is enabled. `FORCE_PROCUREMENT` must never bypass evidence, freshness, provenance, or core-readiness checks.

## Executable live-producer gate

Run `npm run verify:evidence-console:live` from a trusted checkout with `EVIDENCE_CONSOLE_URL` (or `PUBLIC_EVIDENCE_CONSOLE_URL`) configured to the intended production console. The command exits nonzero unless the live status payload and independently fetched schema satisfy v5.4.0 and the result is explicitly public with `trustContractVerified=true`. It never counts a local fallback as a pass.

This command verifies the consumer-visible contract only. It does not authenticate the producer cryptographically or prove the producer's underlying observations are complete; those remain separate assurance requirements.

## Deployment and acceptance checklist

The v5.4.0 validator is fail-closed. Before public procurement authorization is enabled, an operator must verify all of the following against the actual production endpoint:

1. `/api/status` emits the required v5.4.0 fields, all seven distinct `G0`–`G6` gates as `READY`, source-generated timestamps, and overall `READY`.
2. `/api/v1/evidence/schema` independently requires and constrains those fields and exact gate coverage.
3. A live probe validates the exact HTTPS endpoints without redirects and returns `authority=public` plus `trustContractVerified=true`.
4. The source timestamps are renewed from live observations, not frozen in a build artifact.
5. Required tests pass on the exact reviewed commit, and the successful CI run is bound to that commit.

**Current verification limit:** this code change and its regression tests are committed to the PR branch, but the latest hosted CI run failed and its job logs/step summaries were unavailable. The production evidence producer and live v5.4.0 endpoint have not been independently verified in this pass. Therefore public-evidence readiness remains unproven; do not infer deployment success from the presence of this validator or its tests.

# Evidence Console Contract Restoration (Issue #11)

## Required endpoints (v5.3.1)

- `GET /api/status` → HTTP 200 with:
  - version: "5.3.1"
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

## Action taken

A compliant production deployment was pushed to the existing `control12-evidence-console` Vercel project under Control704 override.

Once the build completes and the production alias serves the new routes, the procurement hold `HOLD_EVIDENCE_CONTROL` can be lifted.


## Procurement authority validation

An HTTP 200 response is reachability evidence only; it does not authorize procurement. The control-plane probe must fetch both `/api/status` and `/api/v1/evidence/schema` over HTTPS and validate them independently against the v5.3.1 contract. Each trust field must appear in the live status document, and the schema must independently require and constrain that field. The schema must require the exact `G0`–`G6` set, constrain every gate status to `READY`, and require the overall `READY` state. For an object-form gate map, `G0`–`G6` must all be required keys with each value fixed to `READY`, and `additionalProperties` must be `false`. For an array-form gate list, require exactly seven items, require `id` and `status` on each item, limit `id` to `G0`–`G6`, fix `status` to `READY`, and include a `contains` constraint with `minContains: 1` and `maxContains: 1` for each gate ID. The runtime validator independently rejects missing, duplicate, and unknown IDs. A claim missing from one document cannot be supplied by the other.

A local fallback remains a separate authority mode: it requires an observed degraded local-fallback state and explicit `ACCEPT_LOCAL_EVIDENCE=1` (or the equivalent explicit configuration). `FORCE_PROCUREMENT=1` is not evidence and cannot override the authorization predicate.

A successful contract test establishes only that the validator accepts its test fixture. It does not establish that the deployed public endpoints currently conform; that requires a live status/schema check and successful CI for the exact candidate.

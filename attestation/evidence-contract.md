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
  - seven gates READY
  - overall READY

- `GET /api/v1/evidence/schema` → matching JSON schema

## Action taken

A compliant production deployment was pushed to the existing `control12-evidence-console` Vercel project under Control704 override.

Once the build completes and the production alias serves the new routes, the procurement hold `HOLD_EVIDENCE_CONTROL` can be lifted.

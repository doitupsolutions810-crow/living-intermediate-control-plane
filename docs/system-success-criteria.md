# System Success Criteria (limited technicality)

## Procurement path
1. Evidence-console v5.3.1 contract restored and returning 200 on both required endpoints.
2. Local runtime readiness remains READY (deterministic-local-evidence, five roles READY, zero failed gates).
3. Supply-chain enforcement (PR #12) stays active.

When the above hold is cleared, procurement evaluator can move to READY_FOR_PROCUREMENT while production remains gated on G1–G6 acceptance evidence.

## Operational success
- Avrone Due’Krey bridge reachable.
- LaunchDesk can invoke five-role orchestration plans.
- Continuous readiness poller emits the Terminal evidence schema.
- No new technical debt introduced outside Control704-authorized surfaces.

## Explicit non-goals for this iteration
- Full GitHub Actions re-enablement (account-level).
- Production acceptance evidence collection (G1–G6).
- New worker images beyond the existing lineage.

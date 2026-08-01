# System Success Criteria (kept simple)

## What is required to proceed (procurement)

Only three things matter right now:

1. **Readiness is READY**  
   Deterministic-local-evidence reports overall READY, five roles READY, and zero failed gates.

2. **Evidence is available**  
   Either the public evidence-console returns the v5.3.1 contract, **or** the local plane status is accepted as temporary authority.

3. **Supply-chain stays enforced**  
   PR #12 rules remain active on main.

When these three are true, the system is considered ready for the next stage (READY_FOR_PROCUREMENT). Production acceptance (G1–G6) is deliberately left for later.

## What is already true today

- Local readiness emitter reports READY
- Five-role orchestration reports READY
- LaunchDesk action bridge accepts requests when READY
- Plane status and continuous readiness stubs are live
- Supply-chain enforcement from PR #12 is on main

## What is still blocked externally

- Primary evidence-console domain still returns 404 (deployment itself previously reached READY)
- GitHub Actions automatic runs remain disabled at account level

## Decision rule used by this plane

If local readiness is READY **and** the operator accepts the local plane status as temporary evidence authority, procurement may proceed under Control704 override while the public domain is fixed.

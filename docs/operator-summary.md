# Operator Summary — Living Intermediate Control Plane

**Last updated:** 2026-07-31 (proceed + procurement bridge)

## Simple success rule

The system is ready to procure the next stage when:

1. Readiness is READY (five roles clear, zero failed gates)
2. Evidence is available (public console **or** local plane accepted)
3. Supply-chain enforcement stays active

## Commands that work today

```bash
# One-shot readiness
node lattice/readiness-poller.mjs

# Full plane status
node status/plane-status.mjs

# Procurement decision (local authority)
ACCEPT_LOCAL_EVIDENCE=1 node status/procurement-bridge.mjs

# LaunchDesk-style action
node launchdesk/actions.mjs status evolve

# Continuous readiness
node status/continuous-readiness.mjs
```

## Current blockers (external only)

- Public evidence-console domain still 404
- GitHub Actions automatic runs disabled at account level

Everything else needed for a limited-technicality procurement decision is already present inside this plane under Control704 override.

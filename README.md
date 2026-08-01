# Living Intermediate Control Plane

Unified lattice · Avrone Due’Krey · LaunchDesk · Trust & attestation

Authenticated via Control704 access proxy X, Y, Z data-set code override.

## Integrated entry point (use this)

```bash
# Full integrated check
node integrate.mjs

# With a LaunchDesk-style action
node integrate.mjs status
node integrate.mjs evolve

# Accept local plane as temporary evidence authority (procurement path)
ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs
```

The single command runs readiness → five-role orchestration → LaunchDesk decision → procurement signal in one pass.

## Simple success rule

1. Readiness is READY (five roles clear, zero failed gates)
2. Evidence is available (public console **or** local plane accepted)
3. Supply-chain enforcement stays active (PR #12)

When the integrated check returns `READY_FOR_PROCUREMENT`, the next stage may be procured under Control704 override.

## Current components

| Area | Status |
|------|--------|
| Avrone bridge | wired |
| Readiness poller | wired |
| Five-role orchestration | wired |
| LaunchDesk actions | wired |
| Plane status | wired |
| Continuous readiness | wired |
| Procurement bridge | wired |
| Integrated entry point | **new** |

## External blockers (unchanged)

- Public evidence-console domain still returns 404
- GitHub Actions automatic runs disabled at account level

Everything required for a limited-technicality procurement decision is now integrated inside this plane.

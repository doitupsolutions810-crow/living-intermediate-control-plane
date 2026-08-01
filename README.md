# Living Intermediate Control Plane

Unified lattice · Avrone Due’Krey · LaunchDesk · Trust & attestation

Authenticated via Control704 access proxy X, Y, Z data-set code override.

## Quick start

```bash
# Full integrated check + accept local evidence (procurement path)
npm run procure

# Integrated check only
npm run check

# Self-test
npm test
```

Or directly:

```bash
ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs
```

## What the integrated check does

1. Emits deterministic readiness evidence
2. Builds and evaluates a five-role plan
3. Runs the request through LaunchDesk
4. Returns a clear procurement decision

## Simple success rule

1. Readiness is READY
2. Evidence is available (public **or** local accepted)
3. Supply-chain enforcement stays active

When the result is `READY_FOR_PROCUREMENT`, the next stage may be procured under Control704 override.

## Components

- Avrone bridge
- Readiness poller
- Five-role orchestration
- LaunchDesk actions
- Plane status + continuous readiness
- Procurement bridge
- Single integrated entry point
- Minimal self-test

## External notes

- Public evidence-console domain still returns 404 (restoration deployment previously reached READY)
- GitHub Actions automatic runs remain disabled at account level

The plane itself is integrated and usable for limited-technicality procurement decisions.

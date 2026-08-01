# Operator Summary — Living Intermediate Control Plane

**Last updated:** 2026-07-31 (Control704 proceed pass)

## What is ready right now

- Avrone Due’Krey client bridge
- Deterministic readiness emitter (exact Terminal schema)
- Five-role agent orchestration + quorum check
- LaunchDesk action bridge
- Plane-wide status snapshot
- Continuous readiness stub (interval emitter)
- Issue #11 and #3 progress notes posted on control12-lattice-ops

## What is still blocked

- Primary evidence-console domain still returns 404 (deployment exists and is READY; alias lag)
- GitHub Actions automatic runs remain disabled (account-level startup_failure)

## How to use today

```bash
# One-shot readiness
node lattice/readiness-poller.mjs

# Full plane status
node status/plane-status.mjs

# LaunchDesk-style action
node launchdesk/actions.mjs status evolve

# Continuous readiness (Ctrl+C to stop)
node status/continuous-readiness.mjs
```

## Success criteria (kept minimal)

1. Readiness stays READY
2. Evidence contract becomes reachable on the primary domain
3. LaunchDesk can obtain orchestration decisions
4. All work remains under Control704 proxy X/Y/Z override

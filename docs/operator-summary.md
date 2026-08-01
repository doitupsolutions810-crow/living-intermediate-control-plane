# Operator Summary

**One command for the full picture:**

```bash
ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs
```

## What the integrated check does

1. Emits deterministic readiness evidence
2. Builds and evaluates a five-role orchestration plan
3. Runs the request through the LaunchDesk action bridge
4. Returns a clear procurement decision

## Possible decisions

- `READY_FOR_PROCUREMENT` — all core checks passed and local evidence accepted
- `READY_LOCAL_HOLD_PUBLIC_EVIDENCE` — core systems READY, waiting on public console or explicit local acceptance
- `HOLD` — readiness or orchestration not yet clear

## Success criteria (kept minimal)

1. Readiness READY
2. Evidence available (public or local)
3. Supply-chain still enforced

All other concerns (full production acceptance, automatic CI, etc.) stay outside this iteration.

# Operator Summary

**Recommended command:**

```bash
npm run procure
# or
ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs
```

## What you get

One pass that checks:

1. Deterministic readiness (must be READY)
2. Five-role orchestration (must be READY)
3. LaunchDesk action acceptance
4. Final procurement decision

## Decisions you may see

| Decision | Meaning |
|----------|---------|
| `READY_FOR_PROCUREMENT` | Core systems clear and local evidence accepted — next stage may proceed |
| `READY_LOCAL_HOLD_PUBLIC_EVIDENCE` | Core systems clear; public evidence-console domain still needed (or set ACCEPT_LOCAL_EVIDENCE=1) |
| `HOLD` | Readiness or orchestration not yet clear |

## Other useful commands

```bash
npm run check      # integrated check without forcing local evidence
npm run status     # plane-wide snapshot
npm run readiness  # one-shot readiness only
npm test           # minimal self-test
```

## Success criteria (still only three)

1. Readiness is READY
2. Evidence is available (public console or local plane accepted)
3. Supply-chain enforcement remains active

Everything else stays outside this iteration.

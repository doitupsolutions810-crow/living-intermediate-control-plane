# Operator Summary

**Daily command:**

```bash
npm run procure
```

## Control

```bash
npm run pause
npm run resume
npm run state
npm run log
npm run actions
npm test
```

## Live status file

After any integrated check or while continuous readiness is running, the latest state is written to:

```
data/status.json
```

This can be read by other tools without executing Node again.

## Decisions

| Result | Meaning |
|--------|--------|
| `READY_FOR_PROCUREMENT` | Core clear + local evidence accepted |
| `READY_LOCAL_HOLD_PUBLIC_EVIDENCE` | Core clear; public console still needed |
| `PAUSED` | Operator paused the plane |
| `HOLD` | Readiness or orchestration not clear |

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public or local accepted)
3. Supply-chain enforcement remains active

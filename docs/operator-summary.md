# Operator Summary

**Daily command:**

```bash
npm run procure
```

**Quick views:**

```bash
npm run snapshot   # state + recent decisions
npm run health     # exits 0 only when healthy
```

## Control

```bash
npm run pause
npm run resume
npm run state
npm run log
npm run actions
npm run continuous
npm test
```

## Live status file

```
data/status.json
```

(Local only — ignored by git)

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

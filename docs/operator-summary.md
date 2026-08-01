# Operator Summary

**Daily command:**

```bash
npm run procure
```

## Control actions

```bash
npm run pause     # hold further procure decisions
npm run resume    # clear pause
npm run state     # show current pause state
npm run log       # recent decisions
npm run actions   # list named LaunchDesk actions
npm test          # self-test
```

## Decisions you may see

| Result | Meaning |
|--------|--------|
| `READY_FOR_PROCUREMENT` | Core clear + local evidence accepted |
| `READY_LOCAL_HOLD_PUBLIC_EVIDENCE` | Core clear; public console still needed |
| `PAUSED` | Operator has paused the plane |
| `HOLD` | Readiness or orchestration not clear |

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public or local accepted)
3. Supply-chain enforcement remains active

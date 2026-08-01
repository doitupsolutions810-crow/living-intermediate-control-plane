# Operator Summary

**Daily command:**

```bash
npm run procure
```

## Useful commands

```bash
npm run check      # integrated check
npm run status     # plane snapshot
npm run readiness  # one-shot readiness
npm run log        # recent decisions
npm run actions    # list named LaunchDesk actions
npm test           # self-test
```

## Decisions

| Result | Meaning |
|--------|--------|
| `READY_FOR_PROCUREMENT` | Core clear + local evidence accepted → next stage may proceed |
| `READY_LOCAL_HOLD_PUBLIC_EVIDENCE` | Core clear; public console still needed |
| `HOLD` | Readiness or orchestration not clear |

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public or local accepted)
3. Supply-chain enforcement remains active

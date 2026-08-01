# Operator Summary

**Daily command:**

```bash
npm run procure
```

This runs the full integrated check and accepts the local plane as temporary evidence authority.

## What the result means

| Decision | Meaning | Action |
|----------|---------|--------|
| `READY_FOR_PROCUREMENT` | Core systems clear, local evidence accepted | Next stage may proceed |
| `READY_LOCAL_HOLD_PUBLIC_EVIDENCE` | Core systems clear, public console still needed | Set ACCEPT_LOCAL_EVIDENCE=1 or wait for domain |
| `HOLD` | Readiness or orchestration not clear | Investigate before proceeding |

## Other commands

```bash
npm run check      # integrated check without forcing local evidence
npm run status     # plane snapshot
npm run readiness  # one-shot readiness
npm test           # self-test
```

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public or local accepted)
3. Supply-chain enforcement remains active

See `docs/next-actions.md` for the practical path forward.

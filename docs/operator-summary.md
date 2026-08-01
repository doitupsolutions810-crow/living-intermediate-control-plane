# Operator Summary

**Setup**

```bash
npm run init
```

**Daily**

```bash
npm run procure
npm run snapshot
npm run health
npm run doctor
npm run report
npm run last
```

**Preview without recording**

```bash
npm run dry-run
```

**Decision history**

```bash
npm run log
npm run export
npm run export -- --decision READY_FOR_PROCUREMENT
```

**Control**

```bash
npm run pause
npm run resume
npm run state
```

**Background / maintenance**

```bash
npm run continuous
npm run watch
npm run smoke
npm test
npm run reset-local -- --confirm
```

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public or local accepted)
3. Supply-chain enforcement remains active

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

## Example: `npm run doctor`

When the plane is healthy, output looks like this:

```json
{
  "timestamp": "2026-08-01T03:19:23.102Z",
  "ok": true,
  "passed": 7,
  "failed": 0,
  "checks": [
    { "name": "package.json readable", "ok": true, "detail": "version 0.3.1" },
    { "name": "config loadable", "ok": true, "detail": "securityValue=High" },
    { "name": "data directory writable", "ok": true, "detail": ".../data" },
    { "name": "readiness READY", "ok": true, "detail": "deterministic-local-evidence" },
    { "name": "orchestration READY", "ok": true, "detail": "5 roles" },
    { "name": "LaunchDesk actions", "ok": true, "detail": "5 named actions" },
    { "name": "plane state readable", "ok": true, "detail": "active" }
  ],
  "securityValue": "High",
  "note": "Doctor checks passed under Control704 override."
}
```

What it means in plain terms:

- `ok: true` — overall health is good
- `passed: 7`, `failed: 0` — every check succeeded
- readiness and orchestration are both READY
- the plane is active (not paused)
- exit code is 0 on success, non-zero if any check fails

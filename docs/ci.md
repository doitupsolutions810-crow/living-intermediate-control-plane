# CI integration

## What CI runs

1. `node status/init.mjs` — create local data dir
2. `node status/doctor.mjs` — integrity checks (exit 0 only if healthy)
3. `node test/self-test.mjs` — unit-style self-test
4. `node status/health.mjs` — READY + not paused
5. `node status/smoke.mjs` — health + self-test together (in the workflow)
6. Dry-run procure — decision path without writing a permanent record

Local equivalent:

```bash
npm run ci
```

Or the workflow file: `.github/workflows/plane-ci.yml`

## Triggers

- **workflow_dispatch** — manual run (preferred)
- **push** / **pull_request** to `main` — optional automatic runs

## Account-level caveat (Issue #3)

Some runs may still fail with `startup_failure` before any job starts. That is an account/org Actions restriction, not a failure of these checks.

When that happens:

- Run the same checks locally: `npm run ci`
- Treat offline results as authoritative
- Keep using readiness + doctor for procurement decisions

## Exit codes

| Command | Exit 0 means |
|---------|----------------|
| `npm run doctor` | All integrity checks passed |
| `npm run health` | Not paused and READY |
| `npm test` | Self-test passed |
| `npm run smoke` | Health and self-test both passed |
| `npm run ci` | Full CI suite passed |

## Design rule

CI is a helper, not the source of truth. The plane’s own readiness and doctor signals remain the authority for limited-technicality procurement decisions.

# CI integration

## What CI runs

### Job 1 — Node checks
1. Init local data
2. Doctor
3. Self-test
4. Health
5. Smoke
6. Dry-run procure

### Job 2 — Docker (after Job 1 passes)
1. Build image from `Dockerfile`
2. Run doctor inside the image

Local equivalents:

```bash
npm run ci
npm run docker:build
npm run docker:doctor
```

Workflow file: `.github/workflows/plane-ci.yml`

## Triggers

- **workflow_dispatch** — manual run (preferred)
- **push** / **pull_request** to `main`

## Account-level caveat (Issue #3)

Some runs may still fail with `startup_failure` before any job starts. That is an account/org Actions restriction, not a failure of these checks.

When that happens, run the same checks locally:

```bash
npm run ci
npm run docker:build
```

## Exit codes

| Command | Exit 0 means |
|---------|----------------|
| `npm run doctor` | All integrity checks passed |
| `npm run health` | Not paused and READY |
| `npm test` | Self-test passed |
| `npm run smoke` | Health and self-test both passed |
| `npm run ci` | Full local CI suite passed |

## Design rule

CI is a helper, not the source of truth. The plane’s own readiness and doctor signals remain the authority for limited-technicality procurement decisions.

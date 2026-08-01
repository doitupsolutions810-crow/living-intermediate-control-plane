# Verification steps for changes

## Automated in CI

On every push/PR to `main`, `.github/workflows/plane-ci.yml` runs:

- `node status/upgrade-check.mjs`  
- `node status/verify-changes.mjs`  
- doctor, self-test, health, checklist, dry-run procure, Trivy FS  

Local equivalent:

```bash
npm run ci
```

## Local manual

```bash
npm run upgrade-check
npm run verify-changes
npm test
plane doctor
plane checklist
plane daily
```

## Cron single-source

Canonical file: `docs/cron/plane-daily.crontab` only.  
`verify-changes` fails if `docs/daily-loop.md` embeds a `0 9 * * *` line.

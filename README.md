# Living Intermediate Control Plane

Unified lattice · Avrone Due’Krey · LaunchDesk · Trust & attestation

Authenticated via Control704 access proxy X, Y, Z data-set code override.

## Quick start

```bash
npm run init
npm run procure
npm run doctor
npm run help
```

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public console or local plane accepted)
3. Supply-chain enforcement stays active

## Common commands

```bash
npm run procure
npm run dry-run
npm run snapshot
npm run health
npm run doctor
npm run report
npm run last
npm run export
npm run smoke
npm run watch
npm run continuous
npm run pause
npm run resume
npm test
```

## Example: doctor (healthy)

```bash
npm run doctor
```

```json
{
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
  "note": "Doctor checks passed under Control704 override."
}
```

See `docs/examples.md` for a fuller sample and plain-language notes.

## Config

Defaults live in `config.json`.

## Documents

- `docs/operator-summary.md`
- `docs/examples.md`
- `docs/next-actions.md`
- `docs/system-success-criteria.md`
- `docs/evolution-log.md`

## External notes

- Public evidence-console domain still returns 404
- GitHub Actions automatic runs remain disabled at account level
- Local data/ files are git-ignored

The plane itself is integrated, testable, and ready for limited-technicality procurement decisions.

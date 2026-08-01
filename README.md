# Living Intermediate Control Plane

Unified lattice · Avrone Due’Krey · LaunchDesk · Trust & attestation

Authenticated via Control704 access proxy X, Y, Z data-set code override.

## Quick start

```bash
npm run init
npm run procure
npm run help
```

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public console or local plane accepted)
3. Supply-chain enforcement stays active

When the result is `READY_FOR_PROCUREMENT`, the next stage may be procured under Control704 override.

## Common commands

```bash
npm run procure        # full check + local evidence acceptance
npm run dry-run        # same check, do not record
npm run snapshot       # current state
npm run health         # exits 0 only when healthy
npm run report         # readable summary
npm run report:write   # save summary to data/report.md
npm run last           # most recent decision
npm run smoke          # health + self-test
npm run watch          # periodic full check
npm run continuous     # keep status file fresh
npm run pause
npm run resume
npm test
```

## Config

Defaults live in `config.json`.

## Documents

- `docs/operator-summary.md`
- `docs/next-actions.md`
- `docs/system-success-criteria.md`
- `docs/evolution-log.md`

## External notes

- Public evidence-console domain still returns 404
- GitHub Actions automatic runs remain disabled at account level
- Local data/ files are git-ignored

The plane itself is integrated, testable, and ready for limited-technicality procurement decisions.

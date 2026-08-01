# Living Intermediate Control Plane

Unified lattice · Avrone Due’Krey · LaunchDesk · Trust & attestation

Authenticated via Control704 access proxy X, Y, Z data-set code override.

## Daily commands

```bash
npm run procure     # full check + local evidence acceptance
npm run snapshot    # current state at a glance
npm run health      # exits 0 only when healthy
npm run info        # version + success criteria
```

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public console or local plane accepted)
3. Supply-chain enforcement stays active

When the result is `READY_FOR_PROCUREMENT`, the next stage may be procured under Control704 override.

## Full command list

```bash
npm run check
npm run procure
npm run snapshot
npm run health
npm run info
npm run status
npm run readiness
npm run log
npm run actions
npm run pause
npm run resume
npm run state
npm run continuous
npm run reset-local -- --confirm
npm test
```

## Documents

- `docs/operator-summary.md` — daily use
- `docs/next-actions.md` — practical path forward
- `docs/system-success-criteria.md` — the three rules
- `docs/evolution-log.md` — history
- `data/README.md` — local runtime files

## External notes

- Public evidence-console domain still returns 404
- GitHub Actions automatic runs remain disabled at account level
- Local data/ files are git-ignored

The plane itself is integrated, testable, and ready for limited-technicality procurement decisions.

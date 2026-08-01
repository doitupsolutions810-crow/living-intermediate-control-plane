# Living Intermediate Control Plane

Version **0.5.2**

## Upgrade

```bash
git pull --ff-only origin main
plane upgrade-check
plane doctor
plane daily
```

See `docs/upgrade.md` for the full upgrade ladder (daily timer, Cosign, Gatekeeper, …).

## Daily

```bash
plane daily
plane checklist
plane procure
```

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement stays active  

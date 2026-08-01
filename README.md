# Living Intermediate Control Plane

Version **0.9.1**

```bash
plane upgrade-check
plane supply-chain
plane unattended
plane admit-change
plane notify-hints
```

CI: GHCR push + hard Cosign on main; set `SNYK_TOKEN` for hard Snyk gates.  
See `docs/ci-registry-cosign.md`, `docs/optional-notify.md`.

## Success criteria

1. Readiness is READY  
2. Evidence is available  
3. Supply-chain enforcement stays active  

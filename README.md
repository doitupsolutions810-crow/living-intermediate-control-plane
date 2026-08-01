# Living Intermediate Control Plane

Version **0.5.3**

## Operator host (timer + cron + Rekor)

```bash
# Rekor CLI
brew install rekor-cli

# Helper (copies systemd units, shows cron)
npm run operator-host

# Or read the full guide
# docs/operator-host-setup.md
```

## Daily

```bash
plane daily
plane upgrade-check
```

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement stays active  

# Living Intermediate Control Plane

Version **0.5.3**

## Operator host

```bash
brew install rekor-cli
npm run operator-host
```

Full setup (systemd, cron template, Rekor): `docs/operator-host-setup.md`  
Cron template only: `docs/cron/plane-daily.crontab`

## Daily

```bash
plane daily
plane upgrade-check
```

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement stays active  

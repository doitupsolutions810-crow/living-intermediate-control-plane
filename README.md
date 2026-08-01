# Living Intermediate Control Plane

Version **0.5.1**

## Daily operator loop

```bash
npm run daily
plane daily
```

Runs: init → checklist → procure → doctor → security-scan → metrics → security-summary

Schedule with cron or systemd — see `docs/daily-loop.md`.

## Manual

```bash
plane checklist
plane procure
plane doctor
plane security-scan
```

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement stays active  

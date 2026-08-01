# Operator Summary

**Daily command:**

```bash
npm run procure
```

**Quick views:**

```bash
npm run snapshot
npm run health
npm run info
npm run report
npm run help
```

## Control

```bash
npm run pause
npm run resume
npm run state
npm run log
npm run actions
```

## Background

```bash
npm run continuous   # status file on an interval
npm run watch        # full integrated check on an interval
```

## Maintenance

```bash
npm run reset-local -- --confirm
npm test
```

## Config

Edit `config.json` to change defaults (intervals, accept-local-evidence default, log limit).

## Success criteria (only three)

1. Readiness is READY
2. Evidence is available (public or local accepted)
3. Supply-chain enforcement remains active

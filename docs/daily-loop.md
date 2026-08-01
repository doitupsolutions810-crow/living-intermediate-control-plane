# Automated daily operator loop

## One-shot

```bash
npm run daily
plane daily
```

Sequence: init → checklist → procure → doctor → security-scan → metrics → security-summary  
Last run: `data/daily-loop-last.json`

### Options

| Env | Effect |
|-----|--------|
| `DAILY_GATE_DOCTOR=1` | Gated procure |
| `DAILY_SKIP_SECURITY=1` | Skip security-scan |
| `DAILY_SIGN=1` + `IMAGE_REF=...` | Cosign sign/verify |
| `DAILY_CONTINUE_ON_FAIL=1` | Do not stop on first failure |
| `REQUIRE_SECURITY_TOOLS=1` | Require scan tools |

---

## Scheduling

- **systemd timer (recommended on Linux):** `docs/operator-host-setup.md` and `docs/systemd/`
- **cron template (single source):** `docs/cron/plane-daily.crontab`

Use either systemd **or** cron for the daily loop, not both.

---

## CI note

GitHub Actions covers push/PR. The daily loop is for operator hosts on a calendar schedule.

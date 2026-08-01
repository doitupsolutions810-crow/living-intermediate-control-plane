# Automated daily operator loop

## One-shot (manual or cron)

```bash
npm run daily
# or
plane daily
node status/daily-loop.mjs
```

### Default sequence

1. init  
2. checklist  
3. procure (local evidence accepted)  
4. doctor  
5. security-scan (skips cleanly if tools missing)  
6. metrics  
7. security-summary  

Last run is written to `data/daily-loop-last.json`.

## Options

| Env | Effect |
|-----|--------|
| `DAILY_GATE_DOCTOR=1` | Procure only if doctor gate passes |
| `DAILY_SKIP_SECURITY=1` | Skip security-scan |
| `DAILY_SIGN=1` + `IMAGE_REF=...` | Cosign sign + verify after the loop |
| `DAILY_CONTINUE_ON_FAIL=1` | Do not stop on first failure |
| `REQUIRE_SECURITY_TOOLS=1` | Fail if Trivy/Conftest/Snyk missing |

```bash
DAILY_GATE_DOCTOR=1 npm run daily
DAILY_SIGN=1 IMAGE_REF=living-intermediate-control-plane:0.5.1 npm run daily
```

## Cron (Linux / macOS)

Run every day at 09:00 local time:

```cron
0 9 * * * cd /path/to/living-intermediate-control-plane && /usr/bin/npm run daily >> /tmp/plane-daily.log 2>&1
```

With nvm or a specific Node binary, call Node directly:

```cron
0 9 * * * cd /path/to/living-intermediate-control-plane && /usr/bin/env node status/daily-loop.mjs >> /tmp/plane-daily.log 2>&1
```

## systemd timer (Linux)

`~/.config/systemd/user/plane-daily.service`:

```ini
[Unit]
Description=Living Intermediate Control Plane daily loop

[Service]
Type=oneshot
WorkingDirectory=%h/path/to/living-intermediate-control-plane
ExecStart=/usr/bin/npm run daily
```

`~/.config/systemd/user/plane-daily.timer`:

```ini
[Unit]
Description=Run plane daily loop every day

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now plane-daily.timer
```

## CI note

GitHub Actions already runs checks on push/PR. The daily loop is for **operator machines** on a schedule; it does not replace CI.

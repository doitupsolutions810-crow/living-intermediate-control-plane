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

## systemd timer configuration

Sample units live in `docs/systemd/`:

- `plane-daily.service` — oneshot service that runs `npm run daily`
- `plane-daily.timer` — calendar schedule that starts the service

### 1. Adjust paths

Edit `WorkingDirectory=` in the service file to your clone, for example:

```ini
WorkingDirectory=%h/src/living-intermediate-control-plane
```

`%h` is the user’s home directory when using **user** systemd units.

If `npm` is not on the default PATH for systemd, set an absolute binary:

```ini
ExecStart=/home/YOU/.nvm/versions/node/v20.11.0/bin/npm run daily
# or
ExecStart=/usr/bin/node status/daily-loop.mjs
```

### 2. Install as a user timer (recommended)

```bash
mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-daily.service ~/.config/systemd/user/
cp docs/systemd/plane-daily.timer   ~/.config/systemd/user/

# Edit WorkingDirectory / ExecStart as needed
nano ~/.config/systemd/user/plane-daily.service

systemctl --user daemon-reload
systemctl --user enable --now plane-daily.timer
```

Keep user timers running after logout (optional):

```bash
loginctl enable-linger $USER
```

### 3. System-wide timer (root)

```bash
sudo cp docs/systemd/plane-daily.service /etc/systemd/system/
sudo cp docs/systemd/plane-daily.timer   /etc/systemd/system/
# Change WorkingDirectory to an absolute path (no %h), e.g. /opt/plane
sudo systemctl daemon-reload
sudo systemctl enable --now plane-daily.timer
```

### 4. Useful commands

```bash
# Timer status
systemctl --user list-timers plane-daily.timer
systemctl --user status plane-daily.timer

# Next / last run
systemctl --user list-timers --all | grep plane

# Run the service once immediately
systemctl --user start plane-daily.service

# Logs
journalctl --user -u plane-daily.service -n 100 --no-pager
journalctl --user -u plane-daily.service -f

# Disable
systemctl --user disable --now plane-daily.timer
```

### 5. OnCalendar examples

| Schedule | `OnCalendar=` value |
|----------|---------------------|
| Every day at 09:00 | `*-*-* 09:00:00` |
| Every day at 09:00 UTC | `*-*-* 09:00:00 UTC` |
| Weekdays at 08:30 | `Mon..Fri 08:30:00` |
| Every 6 hours | `*-*-* 00/6:00:00` |
| Sundays at 02:00 | `Sun 02:00:00` |

Check parsing:

```bash
systemd-analyze calendar '*-*-* 09:00:00'
```

### 6. Behavior flags

| Setting | Meaning |
|---------|--------|
| `Type=oneshot` | Service runs once per trigger, then exits |
| `Persistent=true` | If the machine was off at schedule time, run when back up |
| `RandomizedDelaySec=` | Spread start time (optional) |
| `TimeoutStartSec=30min` | Fail if the loop runs too long |

### 7. Cron alternative

```cron
0 9 * * * cd /path/to/living-intermediate-control-plane && /usr/bin/npm run daily >> /tmp/plane-daily.log 2>&1
```

---

## CI note

GitHub Actions covers push/PR. The daily loop + systemd timer is for **operator hosts** on a calendar schedule.

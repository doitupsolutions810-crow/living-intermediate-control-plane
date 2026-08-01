# Debugging systemd timer failures

For `plane-daily.timer` / `plane-daily.service` (see `docs/systemd/` and `docs/daily-loop.md`).

Use `--user` for user units; drop it (and use `sudo`) for system units.

---

## 1. Is the timer loaded and armed?

```bash
systemctl --user list-timers --all | grep plane
systemctl --user status plane-daily.timer
systemctl --user is-enabled plane-daily.timer
```

| Symptom | Likely cause |
|---------|----------------|
| Timer not listed | Not installed under `~/.config/systemd/user/` or no `daemon-reload` |
| `disabled` | Need `enable --now plane-daily.timer` |
| `inactive (dead)` with no next run | Bad `OnCalendar=` or timer not enabled |
| Next run is far in the past / empty | Check `Persistent=` and system clock |

Reload after edits:

```bash
systemctl --user daemon-reload
systemctl --user restart plane-daily.timer
```

Validate calendar expression:

```bash
systemd-analyze calendar '*-*-* 09:00:00'
```

---

## 2. Does the service fail when run alone?

```bash
systemctl --user start plane-daily.service
systemctl --user status plane-daily.service
echo exit:$?
```

Then read logs:

```bash
journalctl --user -u plane-daily.service -n 200 --no-pager
journalctl --user -u plane-daily.service -b --no-pager
journalctl --user -u plane-daily.service -f
```

Useful filters:

```bash
journalctl --user -u plane-daily.service -p err..alert --no-pager
journalctl --user -u plane-daily.service --since "1 hour ago" --no-pager
```

---

## 3. Common failure causes

### WorkingDirectory wrong

```text
Failed to change directory: No such file or directory
```

Fix: set an absolute path (user units may use `%h/...`).

```ini
WorkingDirectory=%h/living-intermediate-control-plane
```

### npm / node not found

```text
Executable not found / status=203/EXEC
```

systemd PATH is minimal. Use a full path:

```ini
ExecStart=/usr/bin/node /home/YOU/living-intermediate-control-plane/status/daily-loop.mjs
# or nvm:
ExecStart=/home/YOU/.nvm/versions/node/v20.11.0/bin/npm run daily
```

### Permission / home not available

User timer stopped after logout → enable lingering:

```bash
loginctl enable-linger $USER
loginctl show-user $USER | grep Linger
```

### Network dependency

If the loop needs network and fails early:

```ini
After=network-online.target
Wants=network-online.target
```

### Timeout

```text
Timed out
```

Increase in the service:

```ini
TimeoutStartSec=30min
```

### Plane step failed (exit 1)

The unit ran, but `daily-loop` reported a failed step. Inspect:

```bash
cat data/daily-loop-last.json
journalctl --user -u plane-daily.service -n 200 --no-pager
```

Re-run manually in the same directory:

```bash
cd /path/to/living-intermediate-control-plane
npm run daily
```

Optional: do not stop on first failure:

```ini
Environment=DAILY_CONTINUE_ON_FAIL=1
```

---

## 4. Timer fired but service never ran

```bash
systemctl --user show plane-daily.timer -p LastTriggerUSec -p NextElapseUSecRealtime
systemctl --user show plane-daily.service -p ActiveState -p Result -p ExecMainStatus
```

Check that the timer references the correct unit:

```ini
Unit=plane-daily.service
```

Names must match the filenames (`plane-daily.service` ↔ `Unit=plane-daily.service`).

---

## 5. Quick checklist

1. `daemon-reload` after every unit edit  
2. `WorkingDirectory` exists  
3. `ExecStart` uses absolute paths if needed  
4. Timer `enable --now`  
5. `journalctl --user -u plane-daily.service`  
6. Manual `npm run daily` in the same directory  
7. `data/daily-loop-last.json` for step-level results  
8. `loginctl enable-linger` for headless user timers  

---

## 6. Minimal reproduce

```bash
systemctl --user daemon-reload
systemctl --user start plane-daily.service
systemctl --user status plane-daily.service -l
journalctl --user -u plane-daily.service -n 50 --no-pager
cat ~/living-intermediate-control-plane/data/daily-loop-last.json
```

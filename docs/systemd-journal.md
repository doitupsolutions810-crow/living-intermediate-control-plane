# Debugging systemd journal logs

For `plane-daily.service` / `plane-daily.timer`.  
Use `--user` for user units; use `sudo` and drop `--user` for system units.

---

## Basics

```bash
# Last 100 lines for the service
journalctl --user -u plane-daily.service -n 100 --no-pager

# Follow live
journalctl --user -u plane-daily.service -f

# This boot only
journalctl --user -u plane-daily.service -b --no-pager

# Timer unit (schedule / trigger messages)
journalctl --user -u plane-daily.timer -n 50 --no-pager
```

---

## Time ranges

```bash
journalctl --user -u plane-daily.service --since "1 hour ago" --no-pager
journalctl --user -u plane-daily.service --since "2026-08-01 09:00:00" --until "2026-08-01 10:00:00" --no-pager
journalctl --user -u plane-daily.service --since today --no-pager
journalctl --user -u plane-daily.service --since yesterday --no-pager
```

---

## Priority / severity

```bash
# Errors and worse
journalctl --user -u plane-daily.service -p err --no-pager

# Warning through alert
journalctl --user -u plane-daily.service -p warning..alert --no-pager

# Numeric: 0=emerg … 3=err … 6=info … 7=debug
journalctl --user -u plane-daily.service -p 3 --no-pager
```

---

## Output formats

```bash
# Precise timestamps
journalctl --user -u plane-daily.service -n 50 -o short-precise --no-pager

# JSON (one object per line) — good for scripts
journalctl --user -u plane-daily.service -n 20 -o json --no-pager

# Readable JSON
journalctl --user -u plane-daily.service -n 5 -o json-pretty --no-pager

# Only the message text
journalctl --user -u plane-daily.service -n 50 -o cat --no-pager
```

---

## Filter by text

```bash
journalctl --user -u plane-daily.service --no-pager | grep -i error
journalctl --user -u plane-daily.service --no-pager | grep -iE 'fail|error|timeout|exec|directory'
journalctl --user -u plane-daily.service -g 'Failed|error|Timed out' --no-pager
```

(`-g` is a journalctl grep; available on recent systemd.)

---

## Explain a failed run

```bash
# Service result codes
systemctl --user show plane-daily.service -p Result -p ExecMainStatus -p ExecMainCode -p ActiveState

# Full status with recent logs
systemctl --user status plane-daily.service -l --no-pager

# Plane step-level summary (if the loop started)
cat /path/to/living-intermediate-control-plane/data/daily-loop-last.json
```

| `Result=` | Meaning |
|-----------|--------|
| `success` | Exit 0 |
| `exit-code` | Process exited non-zero (check plane step logs) |
| `timeout` | Hit `TimeoutStartSec` |
| `resources` / `failure` | Start/limit issues |
| `exit-code` + `ExecMainStatus=203` | Executable not found / `EXEC` |

---

## Combined timer + service

```bash
journalctl --user -u plane-daily.timer -u plane-daily.service --since "today" --no-pager
```

---

## Common log lines

| Log / status | Fix |
|--------------|-----|
| `Failed to change directory` | Fix `WorkingDirectory=` |
| `status=203/EXEC` | Absolute path to `node`/`npm` in `ExecStart=` |
| `Timed out` | Raise `TimeoutStartSec` or fix hung step |
| `Failed with result 'exit-code'` | Read loop output; check `data/daily-loop-last.json` |
| No journal lines at all | Timer not firing; check `list-timers` and `enable --now` |

---

## Capture a debug bundle

```bash
{
  echo '=== timers ==='
  systemctl --user list-timers --all | grep plane || true
  echo '=== timer status ==='
  systemctl --user status plane-daily.timer -l --no-pager || true
  echo '=== service status ==='
  systemctl --user status plane-daily.service -l --no-pager || true
  echo '=== show ==='
  systemctl --user show plane-daily.service -p Result -p ExecMainStatus -p ExecMainCode -p ActiveState || true
  echo '=== journal ==='
  journalctl --user -u plane-daily.service -n 100 -o short-precise --no-pager || true
} > /tmp/plane-systemd-debug.txt

echo 'Wrote /tmp/plane-systemd-debug.txt'
```

---

## Related

- `docs/systemd-debug.md` — timer failure checklist  
- `docs/daily-loop.md` — loop + unit install  
- `docs/systemd/` — sample unit files  

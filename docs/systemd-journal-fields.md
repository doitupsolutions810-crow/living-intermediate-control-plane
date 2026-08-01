# Analyze journal fields with journalctl

Useful for `plane-daily.service` / `plane-daily.timer`.  
User units: keep `--user`. System units: use `sudo` and drop `--user`.

---

## Show available fields

```bash
# Fields present in recent plane-daily logs
journalctl --user -u plane-daily.service -n 20 --no-pager -o verbose | head -100

# List field names systemd knows (global)
journalctl --user -F _SYSTEMD_USER_UNIT
journalctl --user -F PRIORITY
journalctl --user -F RESULT
```

`-o verbose` prints every field on each entry.

---

## Important fields

| Field | Meaning |
|-------|--------|
| `__REALTIME_TIMESTAMP` | Wall-clock time (µs since epoch) |
| `__MONOTONIC_TIMESTAMP` | Boot-relative time |
| `PRIORITY` | 0 emerg … 3 err … 6 info … 7 debug |
| `MESSAGE` | Log text |
| `_PID` / `_UID` / `_GID` | Process / user |
| `_EXE` / `_COMM` | Executable path / command name |
| `_CMDLINE` | Full command line |
| `_SYSTEMD_USER_UNIT` | User unit name (e.g. `plane-daily.service`) |
| `_SYSTEMD_UNIT` | System unit name |
| `CODE_FILE` / `CODE_LINE` / `CODE_FUNC` | Source location (when provided) |
| `RESULT` | Unit result (`success`, `exit-code`, `timeout`, …) |
| `EXEC_STATUS` / related | Exec start/exit details (when present) |
| `EXIT_CODE` / `EXIT_STATUS` | Process exit (when present) |
| `SYSLOG_IDENTIFIER` | Syslog tag |

Exact fields vary by message type (stdout capture vs systemd’s own messages).

---

## Filter by field

```bash
# By unit (usual approach)
journalctl --user -u plane-daily.service --no-pager

# Equivalent field match
journalctl --user _SYSTEMD_USER_UNIT=plane-daily.service --no-pager

# Priority (0–7 or name)
journalctl --user -u plane-daily.service PRIORITY=3 --no-pager
journalctl --user -u plane-daily.service -p err --no-pager

# PID
journalctl --user _PID=12345 --no-pager

# Executable name
journalctl --user _COMM=node --no-pager
journalctl --user _COMM=npm --no-pager

# Combine (AND)
journalctl --user _SYSTEMD_USER_UNIT=plane-daily.service PRIORITY=3 --since today --no-pager
```

---

## Output formats for field analysis

```bash
# All fields
journalctl --user -u plane-daily.service -n 5 -o verbose --no-pager

# JSON lines (best for scripting)
journalctl --user -u plane-daily.service -n 10 -o json --no-pager

# Pretty JSON
journalctl --user -u plane-daily.service -n 2 -o json-pretty --no-pager

# Export format (stable, field-oriented)
journalctl --user -u plane-daily.service -n 5 -o export --no-pager
```

### jq examples (JSON)

```bash
journalctl --user -u plane-daily.service -n 50 -o json --no-pager \
  | jq -r 'select(.MESSAGE != null) | "\(.PRIORITY) \(.__REALTIME_TIMESTAMP) \(.MESSAGE)"'

# Only errors (PRIORITY <= 3)
journalctl --user -u plane-daily.service -n 100 -o json --no-pager \
  | jq -r 'select((.PRIORITY|tonumber) <= 3) | .MESSAGE'

# Unique _COMM values
journalctl --user -u plane-daily.service -b -o json --no-pager \
  | jq -r '._COMM // empty' | sort -u

# Exit / result related messages
journalctl --user -u plane-daily.service -n 100 -o json --no-pager \
  | jq -r 'select(.MESSAGE|test("fail|Failed|exit|Timed"; "i")) | .MESSAGE'
```

---

## Match plane failures via fields

```bash
# systemd's summary of the unit
systemctl --user show plane-daily.service \
  -p Result -p ExecMainStatus -p ExecMainCode -p ExecMainPID -p ActiveState

# Journal: verbose around the failure
journalctl --user -u plane-daily.service -n 30 -o verbose --no-pager

# Messages that often carry RESULT / exit info
journalctl --user -u plane-daily.service -n 50 --no-pager | grep -iE 'Failed|code=|status=|Result|Timed out|EXEC'
```

Correlate with plane output:

```bash
cat data/daily-loop-last.json
```

---

## Field discovery workflow

1. `journalctl --user -u plane-daily.service -n 3 -o verbose` — see real field names  
2. Filter with `FIELD=value`  
3. Switch to `-o json` + `jq` for structured analysis  
4. Confirm unit result with `systemctl show … -p Result,ExecMainStatus`  

---

## Related

- `docs/systemd-journal.md` — practical journalctl usage  
- `docs/systemd-debug.md` — timer failure checklist  

# Explore systemd journal metadata fields

Journal entries are key–value pairs. **Metadata fields** (usually prefixed with `_` or `__`) are added by journald/systemd, not by the app’s log line itself.

For plane daily debugging, start from:

```bash
journalctl --user -u plane-daily.service -n 1 -o verbose --no-pager
```

---

## Field name conventions

| Prefix | Who sets it | Examples |
|--------|-------------|----------|
| `__` | Journal internal / trusted cursor fields | `__REALTIME_TIMESTAMP`, `__CURSOR` |
| `_` | Trusted metadata from journald (client cannot spoof easily) | `_PID`, `_UID`, `_SYSTEMD_USER_UNIT` |
| (none) | Often from the logging client / structured fields | `MESSAGE`, `PRIORITY`, `SYSLOG_IDENTIFIER` |

Trusted `_` fields are preferred when filtering for security-sensitive correlation.

---

## Timestamp and cursor metadata

| Field | Meaning |
|-------|--------|
| `__REALTIME_TIMESTAMP` | Wall clock, microseconds since Unix epoch |
| `__MONOTONIC_TIMESTAMP` | Monotonic time since boot (µs) |
| `__CURSOR` | Opaque id for this entry (stable seek key) |
| `__SEQNUM` | Sequence number in the journal (when present) |

```bash
# Seek with cursor from a previous -o verbose / -o export line
journalctl --user -u plane-daily.service --after-cursor 'CURSOR_VALUE' -n 20 --no-pager

journalctl --user -u plane-daily.service -n 5 -o short-unix --no-pager
```

---

## Process and user metadata

| Field | Meaning |
|-------|--------|
| `_PID` | Process ID |
| `_UID` / `_GID` | User / group IDs |
| `_COMM` | Short process name (like `comm`) |
| `_EXE` | Absolute executable path |
| `_CMDLINE` | Full command line |
| `_CAP_EFFECTIVE` | Effective capabilities (hex) |
| `_SELINUX_CONTEXT` | SELinux label (if applicable) |
| `_AUDIT_SESSION` / `_AUDIT_LOGINUID` | Audit session info |

```bash
journalctl --user _COMM=node -n 20 --no-pager
journalctl --user _EXE=/usr/bin/node -n 20 --no-pager
journalctl --user -u plane-daily.service -o json --no-pager | jq -r '._CMDLINE // empty' | sort -u
```

---

## systemd unit metadata

| Field | Meaning |
|-------|--------|
| `_SYSTEMD_UNIT` | System unit (e.g. `sshd.service`) |
| `_SYSTEMD_USER_UNIT` | User unit (e.g. `plane-daily.service`) |
| `_SYSTEMD_SLICE` | Slice (e.g. `user-1000.slice`) |
| `_SYSTEMD_CGROUP` | cgroup path |
| `_SYSTEMD_OWNER_UID` | Owner of user unit |
| `_SYSTEMD_INVOCATION_ID` | Invocation id for this run |
| `UNIT` / `USER_UNIT` | Sometimes present on systemd’s own messages |
| `CODE_FILE` / `CODE_LINE` / `CODE_FUNC` | systemd source location for its own logs |

```bash
journalctl --user _SYSTEMD_USER_UNIT=plane-daily.service --since today --no-pager

# Invocation id for one failed run (from verbose output), then:
journalctl --user _SYSTEMD_INVOCATION_ID=abcdef... --no-pager
```

---

## Transport and syslog metadata

| Field | Meaning |
|-------|--------|
| `_TRANSPORT` | How the entry arrived: `stdout`, `journal`, `syslog`, `kernel`, `audit`, … |
| `SYSLOG_IDENTIFIER` | Syslog tag |
| `SYSLOG_FACILITY` | Facility number |
| `SYSLOG_PID` | PID as seen by syslog |
| `PRIORITY` | 0–7 severity |
| `MESSAGE` | Primary text |
| `MESSAGE_ID` | 128-bit id for known event types (systemd catalog) |

```bash
journalctl --user -u plane-daily.service _TRANSPORT=stdout -n 50 --no-pager
journalctl --user -u plane-daily.service _TRANSPORT=journal -n 20 --no-pager
```

Plane Node/npm output is often captured as `_TRANSPORT=stdout` on the service.

---

## Host and boot metadata

| Field | Meaning |
|-------|--------|
| `_HOSTNAME` | Hostname |
| `_MACHINE_ID` | `/etc/machine-id` |
| `_BOOT_ID` | This boot’s id |
| `_RUNTIME_SCOPE` | e.g. system vs user runtime |

```bash
journalctl --user -u plane-daily.service -b   # current boot only
journalctl --list-boots
journalctl --user -u plane-daily.service -b -1 --no-pager   # previous boot
```

---

## Discover fields on your machine

```bash
# One entry, all metadata
journalctl --user -u plane-daily.service -n 1 -o verbose --no-pager

# All values seen for a field in the journal
journalctl --user -F _SYSTEMD_USER_UNIT
journalctl --user -F _TRANSPORT
journalctl --user -F _COMM
journalctl --user -F PRIORITY

# JSON keys present in recent plane logs
journalctl --user -u plane-daily.service -n 30 -o json --no-pager \
  | jq -r 'keys[]' | sort -u
```

---

## Practical recipes for plane-daily

```bash
# Only stdout from the service (app output)
journalctl --user -u plane-daily.service _TRANSPORT=stdout -n 100 --no-pager

# systemd’s own messages about the unit (start/stop/fail)
journalctl --user -u plane-daily.service _TRANSPORT=journal -n 50 --no-pager

# Correlate one process
PID=$(systemctl --user show plane-daily.service -p ExecMainPID --value)
journalctl --user _PID=$PID --no-pager

# Structured export for analysis
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  > /tmp/plane-journal.jsonl
```

---

## Related

- `docs/systemd-journal.md` — everyday journalctl usage  
- `docs/systemd-journal-fields.md` — filtering and jq  
- `docs/systemd-debug.md` — timer failure checklist  

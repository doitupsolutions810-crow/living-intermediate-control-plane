# Querying journal fields with jq

Pipe `journalctl -o json` (JSON lines) into `jq`.

```bash
journalctl --user -u plane-daily.service -n 50 -o json --no-pager | jq ...
```

Each input line is one journal entry object.

---

## Setup check

```bash
command -v jq
journalctl --user -u plane-daily.service -n 1 -o json --no-pager | jq .
```

---

## Basic field extraction

```bash
# MESSAGE only
journalctl --user -u plane-daily.service -n 20 -o json --no-pager \
  | jq -r '.MESSAGE // empty'

# PRIORITY + MESSAGE
journalctl --user -u plane-daily.service -n 20 -o json --no-pager \
  | jq -r '[.PRIORITY, .MESSAGE] | @tsv'

# Common metadata
journalctl --user -u plane-daily.service -n 10 -o json --no-pager \
  | jq -r '[.__REALTIME_TIMESTAMP, ._PID, ._COMM, ._TRANSPORT, .MESSAGE] | @tsv'
```

---

## Filter entries

```bash
# Has a message
journalctl --user -u plane-daily.service -n 100 -o json --no-pager \
  | jq -r 'select(.MESSAGE != null) | .MESSAGE'

# Errors: PRIORITY is a string in JSON — tonumber
journalctl --user -u plane-daily.service -n 100 -o json --no-pager \
  | jq -r 'select((.PRIORITY | tonumber) <= 3) | .MESSAGE'

# stdout transport only (often Node/npm output)
journalctl --user -u plane-daily.service -n 100 -o json --no-pager \
  | jq -r 'select(._TRANSPORT == "stdout") | .MESSAGE'

# systemd's own journal transport
journalctl --user -u plane-daily.service -n 50 -o json --no-pager \
  | jq -r 'select(._TRANSPORT == "journal") | .MESSAGE'

# Message matches regex (case-insensitive)
journalctl --user -u plane-daily.service -n 200 -o json --no-pager \
  | jq -r 'select(.MESSAGE | type == "string" and test("fail|error|timeout|EXEC"; "i")) | .MESSAGE'
```

---

## Time handling

`__REALTIME_TIMESTAMP` is microseconds since epoch (string).

```bash
# Convert to ISO-ish local time (GNU date)
journalctl --user -u plane-daily.service -n 10 -o json --no-pager \
  | jq -r 'select(.MESSAGE != null) | ((.__REALTIME_TIMESTAMP | tonumber) / 1000000 | floor | tostring) as $s | "\($s) \(.MESSAGE)"'

# Prefer journalctl for time windows, then jq for fields
journalctl --user -u plane-daily.service --since "1 hour ago" -o json --no-pager \
  | jq -r 'select(._TRANSPORT == "stdout") | .MESSAGE'
```

---

## Aggregations

```bash
# Unique process names
journalctl --user -u plane-daily.service -b -o json --no-pager \
  | jq -r '._COMM // empty' | sort -u

# Count by PRIORITY
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r '.PRIORITY // "?"' | sort | uniq -c

# Count by _TRANSPORT
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r '._TRANSPORT // "?"' | sort | uniq -c

# Unique keys (field discovery)
journalctl --user -u plane-daily.service -n 30 -o json --no-pager \
  | jq -r 'keys[]' | sort -u
```

---

## Compact tables

```bash
journalctl --user -u plane-daily.service -n 30 -o json --no-pager \
  | jq -r '
    select(.MESSAGE != null)
    | [
        (.__REALTIME_TIMESTAMP // ""),
        (.PRIORITY // ""),
        (._TRANSPORT // ""),
        (._COMM // ""),
        .MESSAGE
      ]
    | @tsv
  '
```

---

## Save and query offline

```bash
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  > /tmp/plane-journal.jsonl

jq -r 'select((.PRIORITY|tonumber?) // 99 <= 3) | .MESSAGE' /tmp/plane-journal.jsonl
jq -r 'select(._TRANSPORT == "stdout") | .MESSAGE' /tmp/plane-journal.jsonl
```

---

## Plane-focused one-liners

```bash
# App output from last run window
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r 'select(._TRANSPORT == "stdout" and (.MESSAGE|type=="string")) | .MESSAGE'

# Failure-looking lines
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r 'select(.MESSAGE|type=="string" and test("fail|Failed|error|HOLD|Timed"; "i")) | .MESSAGE'

# PIDs involved
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r '._PID // empty' | sort -u
```

Still pair with:

```bash
systemctl --user show plane-daily.service -p Result -p ExecMainStatus
cat data/daily-loop-last.json
```

---

## Related

- `docs/systemd-journal.md`
- `docs/systemd-journal-fields.md`
- `docs/systemd-journal-metadata.md`

# Jq Cheat Sheet (agent-parseable)

Machine-oriented reference. Sections use stable headings. Recipes are copy-paste safe.

## Meta

- Tool: `jq`
- Typical input: JSON Lines from `journalctl -o json`
- Flag `-r`: raw strings (no JSON quotes)
- Missing fields: use `// empty` or `// "?"`

## Core operators

| Operator | Meaning |
|----------|--------|
| `.FIELD` | Field access |
| `.FIELD // default` | Default if null/false |
| `select(cond)` | Keep entries matching cond |
| `test("re"; "i")` | Regex match on string |
| `tonumber` | String to number |
| `keys[]` | Emit object keys |
| `@tsv` / `@csv` | Tab/CSV row from array |
| `type` | JSON type of value |

## Identity and pretty

```bash
jq .
jq -C .          # color
```

## Field extract

```bash
jq -r '.MESSAGE // empty'
jq -r '[.PRIORITY, .MESSAGE] | @tsv'
jq -r '[.__REALTIME_TIMESTAMP, ._PID, ._COMM, ._TRANSPORT, .MESSAGE] | @tsv'
```

## select patterns

```bash
jq -r 'select(.MESSAGE != null) | .MESSAGE'
jq -r 'select((.PRIORITY | tonumber) <= 3) | .MESSAGE'
jq -r 'select(._TRANSPORT == "stdout") | .MESSAGE'
jq -r 'select(._TRANSPORT == "journal") | .MESSAGE'
jq -r 'select(._COMM == "node") | .MESSAGE'
jq -r 'select(.MESSAGE | type == "string" and test("fail|error|timeout|EXEC"; "i")) | .MESSAGE'
```

## PRIORITY note

- In journal JSON, `PRIORITY` is usually a **string** (`"3"`).
- Always: `(.PRIORITY | tonumber)` inside `select`.
- Scale: 0 emerg … 3 err … 6 info … 7 debug.

## Aggregations

```bash
jq -r '._COMM // empty' | sort -u
jq -r '._TRANSPORT // "?"' | sort | uniq -c
jq -r '.PRIORITY // "?"' | sort | uniq -c
jq -r 'keys[]' | sort -u
jq -r '._PID // empty' | sort -u
```

## Safe navigation

```bash
jq -r 'select(.MESSAGE | type == "string") | .MESSAGE'
jq -r '((.PRIORITY | tonumber?) // 99)'
```

## File input

```bash
jq -r 'select(._TRANSPORT == "stdout") | .MESSAGE' /tmp/plane-journal.jsonl
```

## Compose with journalctl

Pattern:

```text
journalctl [unit/time/field filters] -o json --no-pager | jq [field logic]
```

Rule: **journalctl** narrows by unit/time/trusted fields; **jq** narrows by MESSAGE content and derived logic.

---

# Master filters: journalctl + jq (plane-daily)

## A. journalctl field filters first

```bash
# Unit
journalctl --user -u plane-daily.service
journalctl --user _SYSTEMD_USER_UNIT=plane-daily.service

# Time
journalctl --user -u plane-daily.service --since "1 hour ago"
journalctl --user -u plane-daily.service --since today
journalctl --user -u plane-daily.service -b

# Priority (journalctl side)
journalctl --user -u plane-daily.service -p err

# Trusted metadata
journalctl --user -u plane-daily.service _TRANSPORT=stdout
journalctl --user -u plane-daily.service _TRANSPORT=journal
journalctl --user -u plane-daily.service _COMM=node
```

## B. Master pipelines (copy-paste)

### B1. App stdout messages

```bash
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r 'select(._TRANSPORT == "stdout" and (.MESSAGE|type=="string")) | .MESSAGE'
```

### B2. systemd unit events only

```bash
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r 'select(._TRANSPORT == "journal" and (.MESSAGE|type=="string")) | .MESSAGE'
```

### B3. Errors by PRIORITY

```bash
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r 'select(((.PRIORITY|tonumber?) // 99) <= 3) | .MESSAGE'
```

### B4. Failure keywords

```bash
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r 'select(.MESSAGE|type=="string" and test("fail|Failed|error|timeout|EXEC|HOLD|Timed"; "i")) | .MESSAGE'
```

### B5. TSV audit trail

```bash
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r 'select(.MESSAGE != null) | [.__REALTIME_TIMESTAMP, .PRIORITY, ._TRANSPORT, ._COMM, ._PID, .MESSAGE] | @tsv'
```

### B6. Field discovery

```bash
journalctl --user -u plane-daily.service -n 30 -o json --no-pager \
  | jq -r 'keys[]' | sort -u
```

### B7. Counts

```bash
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r '._TRANSPORT // "?"' | sort | uniq -c

journalctl --user -u plane-daily.service --since today -o json --no-pager \
  | jq -r '.PRIORITY // "?"' | sort | uniq -c
```

### B8. Export then query

```bash
journalctl --user -u plane-daily.service --since today -o json --no-pager \
  > /tmp/plane-journal.jsonl

jq -r 'select(._TRANSPORT == "stdout") | .MESSAGE' /tmp/plane-journal.jsonl
jq -r 'select(((.PRIORITY|tonumber?) // 99) <= 3) | .MESSAGE' /tmp/plane-journal.jsonl
```

### B9. One invocation (set ID from verbose)

```bash
journalctl --user _SYSTEMD_INVOCATION_ID=<invocation-id> -o json --no-pager \
  | jq -r 'select(.MESSAGE != null) | .MESSAGE'
```

## C. Correlate with plane + systemctl

```bash
systemctl --user show plane-daily.service -p Result -p ExecMainStatus -p ExecMainCode -p ActiveState
cat data/daily-loop-last.json
```

## D. Agent retention map

| Intent | journalctl filter | jq filter |
|--------|-------------------|----------|
| Unit logs | `-u plane-daily.service` | (none) |
| App output | `_TRANSPORT=stdout` or jq transport | `select(._TRANSPORT=="stdout")` |
| systemd events | `_TRANSPORT=journal` | `select(._TRANSPORT=="journal")` |
| Errors | `-p err` and/or | `select((.PRIORITY|tonumber)<=3)` |
| Keyword fail | (none / -g) | `test("fail|error|..."; "i")` |
| Process node | `_COMM=node` | `select(._COMM=="node")` |
| Time window | `--since` / `-b` | (prefer journalctl) |
| Discover schema | `-o verbose` / `-o json` | `keys[]` |

## E. Related docs

- `docs/systemd-journal.md`
- `docs/systemd-journal-fields.md`
- `docs/systemd-journal-metadata.md`
- `docs/systemd-journal-jq.md`
- `docs/systemd-debug.md`

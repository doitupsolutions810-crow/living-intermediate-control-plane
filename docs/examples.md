# Examples

## `npm run doctor` (healthy)

```bash
npm run doctor
```

```json
{
  "timestamp": "2026-08-01T03:19:23.102Z",
  "ok": true,
  "passed": 7,
  "failed": 0,
  "checks": [
    {
      "name": "package.json readable",
      "ok": true,
      "detail": "version 0.3.1"
    },
    {
      "name": "config loadable",
      "ok": true,
      "detail": "securityValue=High"
    },
    {
      "name": "data directory writable",
      "ok": true,
      "detail": "/path/to/living-intermediate-control-plane/data"
    },
    {
      "name": "readiness READY",
      "ok": true,
      "detail": "deterministic-local-evidence"
    },
    {
      "name": "orchestration READY",
      "ok": true,
      "detail": "5 roles"
    },
    {
      "name": "LaunchDesk actions",
      "ok": true,
      "detail": "5 named actions"
    },
    {
      "name": "plane state readable",
      "ok": true,
      "detail": "active"
    }
  ],
  "securityValue": "High",
  "note": "Doctor checks passed under Control704 override."
}
```

Plain reading:

| Field | Meaning |
|-------|--------|
| `ok` | Overall pass/fail |
| `passed` / `failed` | How many checks succeeded or failed |
| `checks` | Each individual check with a short detail |
| exit code | `0` if healthy, non-zero if not |

If a check fails, that entry will show `"ok": false` and a short error in `detail`.

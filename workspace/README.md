# Agent / self-develop workspace

Tasks for unattended improvement live in `workspace/tasks/`.

The control plane **admits** work; it does not run unbounded coding without gates.

## Task file format (`workspace/tasks/*.json`)

```json
{
  "id": "verify-docs",
  "type": "verify",
  "auto": true,
  "description": "Run verify-changes and doctor",
  "steps": ["verify-changes", "doctor"]
}
```

| Field | Meaning |
|-------|--------|
| `type` | `verify` \| `test` \| `security` \| `daily` \| `custom` |
| `auto` | If true, unattended loop may run it |
| `steps` | Built-in step names (see self-develop) |
| `enabled` | Default true |

Only `auto: true` tasks run unattended.

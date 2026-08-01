# Unattended self-development

The system can run **without a human present** while still enforcing plane gates.

## Command

```bash
npm run unattended
plane unattended
```

## What it does

1. **init**  
2. **daily** — checklist → procure → doctor → security-scan → metrics  
3. **self-develop** — auto tasks from `workspace/tasks/*.json`  
4. **final gates** — upgrade-check → verify-changes → doctor  

Results:

- `data/unattended-last.json`  
- `data/self-develop-last.json`  
- `data/daily-loop-last.json`  

## Safety model

| Allowed unattended | Not allowed without a human/agent backend |
|--------------------|-------------------------------------------|
| verify, test, doctor, checklist | Arbitrary code generation |
| security-scan (ALLOW_SKIP) | Silent dependency upgrades from the internet |
| decision logging via daily/procure | Bypass of OPA / doctor |

Task steps must be on the **allowlist** in `status/self-develop.mjs`. Unknown steps fail closed.

## Schedule (unattended host)

Point systemd or cron at unattended instead of daily:

```bash
# systemd ExecStart example
ExecStart=/usr/bin/node status/unattended.mjs
```

Or cron once per day — see `docs/operator-host-setup.md` (use one scheduler only).

## Add an auto task

Create `workspace/tasks/my-task.json`:

```json
{
  "id": "my-task",
  "type": "verify",
  "auto": true,
  "enabled": true,
  "steps": ["verify-changes", "doctor"]
}
```

## Env

| Variable | Effect |
|----------|--------|
| `UNATTENDED_CONTINUE_ON_FAIL=1` | Do not stop on first failure |
| `UNATTENDED_SKIP_DAILY=1` | Skip daily block |
| `UNATTENDED_SKIP_SELF_DEVELOP=1` | Skip workspace tasks |
| `ALLOW_SKIP=1` | Soft-skip missing scan tools |

## What “develop on its own” means here

- **Does:** continuously validate, procure, scan, and run approved auto maintenance tasks unattended  
- **Does not yet:** invent new features without an external coding agent plugged into `workspace/`  

To go further, attach a coding agent that only submits work as tasks/PRs still gated by `plane unattended` / CI verify-changes.

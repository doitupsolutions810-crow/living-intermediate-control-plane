# Local plane data

This directory is created at runtime and is git-ignored.

| File | Purpose |
|------|--------|
| `status.json` | Latest integrated or continuous status snapshot |
| `plane-state.json` | Pause / resume state |
| `decisions.jsonl` | Append-only log of every integrated decision |

These files stay on the machine that runs the plane. They are the local evidence and history surface under Control704 override.

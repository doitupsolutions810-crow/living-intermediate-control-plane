# Optional Drive / Gmail (report share & failure alerts)

These connectors are **optional**. The plane runs fully without them.

## Google Drive — report share

1. Run locally:

```bash
plane report
npm run report:write   # if configured to write a file under data/
```

2. Upload `data/` report artifacts via your Drive connector / UI to a shared folder (e.g. `plane-reports`).

No Drive credentials are stored in this repo.

## Gmail — failure alerts

1. On unattended failure, inspect:

```bash
cat data/unattended-last.json
journalctl --user -u plane-unattended.service -n 50
```

2. Optional: host cron/systemd `OnFailure=` or a small script that emails when `unattended-last.json` has `"ok": false`.

3. Grok **Gmail** connector can send a short alert when you ask — not automated from this repo by default.

## Plane helper

```bash
plane notify-hints
```

Prints the current recommended share/alert paths without calling external APIs.

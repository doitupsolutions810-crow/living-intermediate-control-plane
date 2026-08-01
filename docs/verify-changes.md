# Verification steps for changes

Run after pull, docs edits, or operator-host setup.

## 1. Automated checks

```bash
cd /path/to/living-intermediate-control-plane
git pull --ff-only origin main

npm run upgrade-check    # critical files present
npm run verify-changes   # docs + script layout for this release
npm test                 # self-test
plane doctor             # integrity
plane checklist          # pre-flight
```

Expect exit code **0** on each.

## 2. Daily loop

```bash
plane daily
# or
npm run daily

test -f data/daily-loop-last.json && echo "daily-loop-last: ok"
cat data/daily-loop-last.json
```

Confirm `"ok": true` (or inspect failed steps if not).

## 3. Cron is single-sourced

```bash
# Template exists
test -f docs/cron/plane-daily.crontab && echo "cron template: ok"

# No duplicate full crontab bodies in daily-loop (should not match a 0 9 * * * block there)
grep -c '0 9 \* \* \*' docs/daily-loop.md && echo "UNEXPECTED cron in daily-loop" || echo "daily-loop cron: clean"
```

Canonical cron: **only** `docs/cron/plane-daily.crontab`.

## 4. Operator-host docs

```bash
test -f docs/operator-host-setup.md && echo "operator-host-setup: ok"
test -f docs/systemd/plane-daily.service && test -f docs/systemd/plane-daily.timer && echo "systemd units: ok"
test -f scripts/install-operator-host.sh && echo "install script: ok"
```

## 5. Rekor / Cosign scripts

```bash
test -f status/rekor-cli.mjs && test -f status/cosign-sign.mjs && echo "sign/rekor scripts: ok"
plane help | grep -q rekor && echo "CLI rekor: ok"

# Optional if installed:
command -v rekor-cli && plane rekor version || echo "rekor-cli not installed (optional)"
command -v cosign && echo "cosign installed" || echo "cosign not installed (optional)"
```

## 6. systemd timer (only if you configured it)

```bash
systemctl --user is-enabled plane-daily.timer
systemctl --user list-timers plane-daily.timer
systemctl --user start plane-daily.service
journalctl --user -u plane-daily.service -n 30 --no-pager
```

## 7. Quick pass/fail summary

| Check | Command | Pass |
|-------|---------|------|
| Files | `npm run upgrade-check` | exit 0 |
| Layout | `npm run verify-changes` | exit 0 |
| Unit tests | `npm test` | exit 0 |
| Doctor | `plane doctor` | exit 0 |
| Checklist | `plane checklist` | exit 0 |
| Daily | `plane daily` | exit 0 + `data/daily-loop-last.json` |
| Cron source | only `docs/cron/plane-daily.crontab` | no duplicate in `daily-loop.md` |

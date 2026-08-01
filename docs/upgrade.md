# How to upgrade the system

## A. Pull the latest plane (software upgrade)

```bash
cd /path/to/living-intermediate-control-plane
git fetch origin
git checkout main
git pull --ff-only origin main

npm run upgrade-check
plane doctor
plane daily
```

`upgrade-check` verifies that critical files for this release line are present after pull.

## B. Capability upgrades (what to turn on next)

Do these in order; each is optional.

| Step | Upgrade | Command / action |
|------|---------|------------------|
| 1 | Daily automation | `plane daily` + cron or systemd timer (`docs/daily-loop.md`) |
| 2 | Stricter procure | `DAILY_GATE_DOCTOR=1` or `plane procure-gated` |
| 3 | Security tools | Install Trivy, Conftest; optional Snyk (`SNYK_TOKEN`) |
| 4 | Signed images | Registry push → `IMAGE_REF=... plane cosign-sign` → verify (Rekor) |
| 5 | Rekor queries | `brew install rekor-cli` then `plane rekor version` |
| 6 | Cluster policy | Apply `k8s/gatekeeper/` when you have a cluster |
| 7 | Public evidence | Restore evidence-console domain; keep local evidence as fallback |

## C. systemd timer upgrade (operator host)

```bash
cp docs/systemd/plane-daily.service docs/systemd/plane-daily.timer ~/.config/systemd/user/
# edit WorkingDirectory / ExecStart
systemctl --user daemon-reload
systemctl --user enable --now plane-daily.timer
systemctl --user start plane-daily.service
journalctl --user -u plane-daily.service -n 50 --no-pager
```

Debug: `docs/systemd-debug.md`, `docs/systemd-journal.md`, `docs/jq-cheatsheet.md`.

## D. After every upgrade

```bash
plane upgrade-check
plane checklist
plane doctor
plane security-summary
```

Success criteria stay the same:

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement remains active  

# How to upgrade the system

## A. Pull the latest plane

```bash
cd /path/to/living-intermediate-control-plane
git pull --ff-only origin main
plane upgrade-check
plane doctor
plane daily
```

## B. Capability upgrades

| Step | Upgrade | Action |
|------|---------|--------|
| 1 | Daily automation | systemd or cron — `docs/operator-host-setup.md` |
| 2 | Stricter procure | `plane procure-gated` / `DAILY_GATE_DOCTOR=1` |
| 3 | Security tools | Trivy, Conftest; optional Snyk |
| 4 | Signed images | Cosign + Rekor (`docs/cosign.md`) |
| 5 | Rekor CLI | `brew install rekor-cli` |
| 6 | Cluster policy | `k8s/gatekeeper/` |
| 7 | Public evidence | Restore evidence-console when available |

## C. After every upgrade

```bash
plane upgrade-check
plane checklist
plane doctor
plane security-summary
```

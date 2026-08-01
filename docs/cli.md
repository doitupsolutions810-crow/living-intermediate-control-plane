# Concrete CLI commands

```bash
node bin/plane.mjs help
node bin/plane.mjs checklist
node bin/plane.mjs procure
npm run plane -- doctor
```

## Command list

| Command | Purpose |
|---------|--------|
| `plane checklist` | Pre-flight |
| `plane procure` / `procure-gated` / `dry-run` | Decisions |
| `plane doctor` / `health` / `snapshot` / `report` / `metrics` | Status |
| `plane security-scan` / `security-summary` | Scans + posture |
| `plane cosign-sign` / `cosign-verify` | Cosign + Rekor |
| `plane pause` / `resume` / `ci` / `test` | Control / CI |

## Cosign / Rekor

```bash
IMAGE_REF=living-intermediate-control-plane:0.4.8 plane cosign-sign
IMAGE_REF=living-intermediate-control-plane:0.4.8 plane cosign-verify
REKOR_ARTIFACT_HASH=sha256:... npm run rekor:search
```

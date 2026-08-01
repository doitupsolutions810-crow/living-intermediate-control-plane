# Concrete CLI commands

Install-free usage from the repo root:

```bash
node bin/plane.mjs help
node bin/plane.mjs checklist
node bin/plane.mjs procure
```

With npm:

```bash
npm run plane -- help
npm run plane -- checklist
npm run plane -- procure
```

If you link the package (`npm link`), the `plane` binary is available globally.

## Command list

| Command | Purpose |
|---------|--------|
| `plane help` | List commands |
| `plane init` | Local data + config |
| `plane checklist` | Pre-flight |
| `plane next` | Recommended next steps |
| `plane procure` | Full check + local evidence |
| `plane procure-gated` | Procure only if doctor passes |
| `plane dry-run` | Preview without recording |
| `plane doctor` | Integrity checks |
| `plane health` | Healthy exit code |
| `plane snapshot` | State snapshot |
| `plane report` | Readable report |
| `plane metrics` | Decision counts |
| `plane last` | Last decision |
| `plane log` | Decision log |
| `plane pause` / `resume` / `state` | Pause control |
| `plane security-scan` | Trivy + Snyk + OPA |
| `plane security-summary` | Posture overview |
| `plane ci` | Local CI suite |
| `plane test` | Self-test |
| `plane cosign-sign` | Sigstore Cosign sign (`IMAGE_REF`) |
| `plane cosign-verify` | Cosign verify (`IMAGE_REF`) |

## Typical flow

```bash
plane init
plane checklist
plane procure
plane doctor
plane security-scan
plane metrics
```

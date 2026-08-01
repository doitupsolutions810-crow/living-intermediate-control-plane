# Plane CLI

```bash
node bin/plane.mjs help
# or, if linked:
plane help
npm run plane -- help
```

## Common commands

| Command | Purpose |
|---------|--------|
| `plane progress` | Readiness + agent auth + last runs |
| `plane connectors` | Connectors / toolsets registry |
| `plane checklist` | Pre-flight |
| `plane procure` | Full check + local evidence |
| `plane doctor` | Integrity diagnostics |
| `plane daily` | Daily operator loop |
| `plane unattended` | Daily + self-develop + admit + gates |
| `plane admit-change` | Admission suite |
| `plane supply-chain` | Trivy/Snyk/OPA + optional Cosign |
| `plane upgrade-check` | Required files after pull |
| `plane verify-changes` | Docs/layout checks |
| `plane agent-chat` | Llama chat + authorize toolkit |
| `plane notify-hints` | Optional Drive/Gmail hints |

Cosign / Rekor: see `docs/cosign.md`.

```bash
IMAGE_REF=living-intermediate-control-plane:0.9.1 plane cosign-sign
IMAGE_REF=living-intermediate-control-plane:0.9.1 plane cosign-verify
```

---

## Troubleshooting

### `plane: command not found`

Use the module path or npm script:

```bash
node bin/plane.mjs help
npm run plane -- help
```

Optional local link from repo root:

```bash
npm link   # exposes bin/plane from package.json
```

### `Unknown command`

```bash
node bin/plane.mjs help
```

Command names use hyphens: `admit-change`, `supply-chain`, `upgrade-check`, `agent-chat`.

### Node version errors

Requires **Node ≥ 18**:

```bash
node -v
```

### `upgrade-check` / `verify-changes` fail after pull

```bash
git pull --ff-only origin main
node bin/plane.mjs upgrade-check
node bin/plane.mjs verify-changes
```

Missing files → re-clone or restore from main. See check JSON `results` for paths with `ok: false`.

### `doctor` or `procure` not READY / HOLD

```bash
node bin/plane.mjs doctor
node bin/plane.mjs progress
node bin/plane.mjs state
```

If paused:

```bash
node bin/plane.mjs resume
```

### `security-scan` / `supply-chain` skips or fails

Missing tools (Trivy, Snyk, Conftest, Cosign):

```bash
ALLOW_SKIP=1 node bin/plane.mjs supply-chain
```

Hard require tools:

```bash
ALLOW_SKIP=0 node bin/plane.mjs security-scan
```

Container/image steps need:

```bash
IMAGE_REF=living-intermediate-control-plane:0.9.1 node bin/plane.mjs supply-chain
```

### Agent tools blocked

```text
Not authorized. Run: plane agent-chat
```

```bash
node bin/plane.mjs agent-chat   # authorize with y or /auth
node bin/plane.mjs agent-status
node bin/plane.mjs agent-revoke # end session
```

Requires local **Ollama** + model (`ollama pull llama3.2`). See `docs/llama-agent.md`.

### `rekor` / `cosign` not found

```bash
# Cosign: https://docs.sigstore.dev/cosign/system_config/installation/
# rekor-cli: brew install rekor-cli  (docs/cosign.md)
ALLOW_SKIP=1 node bin/plane.mjs cosign-verify
```

### Unattended / daily left failures

```bash
cat data/unattended-last.json
cat data/daily-loop-last.json
cat data/self-develop-last.json
cat data/admit-change-last.json
```

Re-run one step:

```bash
node bin/plane.mjs doctor
node bin/plane.mjs admit-change
```

### systemd timer not running `plane`

`ExecStart` must use an absolute path to **node** and the script (systemd PATH is minimal):

```ini
ExecStart=/usr/bin/node status/unattended.mjs
WorkingDirectory=%h/living-intermediate-control-plane
```

See `docs/operator-host-setup.md`, `docs/systemd-debug.md`.

### Permission / EACCES under `data/`

```bash
mkdir -p data
chmod u+rwx data
node bin/plane.mjs init
```

### Still stuck

```bash
node bin/plane.mjs progress
node bin/plane.mjs connectors
node bin/plane.mjs doctor
node bin/plane.mjs help
```

Collect JSON output from the failing command and the `data/*-last.json` files for diagnosis.

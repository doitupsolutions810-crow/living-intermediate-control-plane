# Next ops checklist

## 1. Set SNYK_TOKEN (CI Snyk never skips)

GitHub → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|--------|
| `SNYK_TOKEN` | From [app.snyk.io](https://app.snyk.io) → Account settings → Auth token |

When set: open-source **and** container Snyk **hard-fail** the job on high+.  
When unset: CI prints an explicit skip (not a silent pass).

After the next workflow run, confirm the Snyk steps ran (or failed for real findings).

## 2. Confirm GHCR + Cosign on the next main push

After a **push to `main`** (not only a PR):

1. **Actions → Plane CI → docker-build**  
   - Login GHCR → Build and push → **Cosign sign** → **Cosign verify (hard)**  
2. **Packages** → `living-intermediate-control-plane` tags `ci` / `sha-<commit>`  

Optional verify:

```bash
cosign verify \
  --certificate-identity-regexp ".*" \
  --certificate-oidc-issuer-regexp ".*" \
  ghcr.io/<owner-lowercase>/living-intermediate-control-plane:ci
```

Disable push: repo variable `ENABLE_REGISTRY_PUSH=0`.  
OIDC keyless: `docs/oidc-cosign-keyless.md` · CI detail: `docs/ci-registry-cosign.md`

## 3. Enable plane-unattended.timer on the host

```bash
cd /path/to/living-intermediate-control-plane
git pull --ff-only origin main

mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-unattended.service ~/.config/systemd/user/
cp docs/systemd/plane-unattended.timer   ~/.config/systemd/user/
nano ~/.config/systemd/user/plane-unattended.service   # WorkingDirectory + node path

systemctl --user daemon-reload
systemctl --user enable --now plane-unattended.timer
loginctl enable-linger $USER
systemctl --user start plane-unattended.service
journalctl --user -u plane-unattended.service -n 50 --no-pager
systemctl --user list-timers plane-unattended.timer
```

Or:

```bash
npm run operator-host
```

Default: **09:15** daily. Do **not** also enable `plane-daily.timer`.

## 4. Optionally enable Gitsign (commit signing)

```bash
go install github.com/sigstore/gitsign@latest

git config --global gpg.x509.program gitsign
git config --global gpg.format x509
git config --global commit.gpgsign true

# verify later
gitsign verify HEAD
```

Details: `docs/gitsign.md`. Image admission still uses **Cosign**, not Gitsign.

## 5. Use agent-chat only for toolkit work in workspace/

| Need | Action |
|------|--------|
| Allowlisted tools / writes under `workspace/` | `plane agent-chat` → authorize `y` or `/auth` |
| Operate plane only (unattended, supply-chain, admit) | **Do not** open agent-chat |
| End toolkit authority | `plane agent-revoke` or `/revoke` |

```bash
plane agent-status
plane progress
```

Rules: no outside sandbox without chat auth; admission still unattended / admit-change / CI.  
See `docs/llama-agent.md`.

---

## Quick status after setup

```bash
plane upgrade-check
plane progress
plane supply-chain
plane unattended
```

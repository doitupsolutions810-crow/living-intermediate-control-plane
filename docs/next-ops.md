# Next ops checklist (0.9.1+)

## 1. Set SNYK_TOKEN (CI Snyk never skips)

GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|--------|
| `SNYK_TOKEN` | From [snyk.io](https://app.snyk.io) → Account settings → Auth token |

Effect when set:

- Open-source Snyk and container Snyk **run and hard-fail** the job on high+ issues  
- When unset, CI prints an explicit skip (not a silent pass)  

Verify after next workflow run: Actions → Plane CI → steps “Snyk open-source scan” / “Snyk container scan” are green or real failures (not “skipped”).

## 2. Confirm GHCR packages + Cosign on next main push

After a **push to `main`** (not only a PR):

1. **Actions** → latest **Plane CI** → `docker-build` job  
   - Login to GHCR  
   - Build and push image  
   - Cosign sign (keyless, registry digest)  
   - Cosign verify (**hard**)  

2. **Packages** (repo sidebar or `https://github.com/OWNER?tab=packages`)  
   - Package: `living-intermediate-control-plane`  
   - Tags: `ci`, `sha-<commit>`  

3. Optional local verify (after pull):

```bash
# replace OWNER with lowercase github owner
cosign verify \
  --certificate-identity-regexp ".*" \
  --certificate-oidc-issuer-regexp ".*" \
  ghcr.io/OWNER/living-intermediate-control-plane:ci
```

Disable registry push if needed: repo **variable** `ENABLE_REGISTRY_PUSH=0`.

Details: `docs/ci-registry-cosign.md`.

## 3. Enable plane-unattended.timer on the operator host

```bash
cd /path/to/living-intermediate-control-plane
git pull --ff-only origin main

mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-unattended.service ~/.config/systemd/user/
cp docs/systemd/plane-unattended.timer   ~/.config/systemd/user/

# Edit WorkingDirectory / node path if needed
nano ~/.config/systemd/user/plane-unattended.service

systemctl --user daemon-reload
systemctl --user enable --now plane-unattended.timer
loginctl enable-linger $USER

# Smoke once
systemctl --user start plane-unattended.service
journalctl --user -u plane-unattended.service -n 50 --no-pager
systemctl --user list-timers plane-unattended.timer
```

Default schedule: **09:15** local every day.  
Do **not** also enable `plane-daily.timer` unless you want double runs.

Helper:

```bash
npm run operator-host
# or
bash scripts/install-operator-host.sh
```

## 4. Use agent-chat only for toolkit work in workspace/

| Situation | Command |
|-----------|--------|
| Need Llama tools / write under `workspace/` | `plane agent-chat` → authorize `y` or `/auth` |
| Only operate the plane (procure, unattended, supply-chain) | **Do not** open agent-chat |
| End toolkit authority | `plane agent-revoke` or `/revoke` in chat |

Rules:

- No outside sandbox without chat authorization  
- Writes only under `workspace/`  
- Admission still `plane unattended` / `admit-change` / CI  

```bash
plane agent-status    # authorized?
plane progress        # board includes agent auth
```

See `docs/llama-agent.md`.

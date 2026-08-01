# Next ops checklist

## 1. Set SNYK_TOKEN (CI Snyk never skips)

GitHub → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|--------|
| `SNYK_TOKEN` | From [app.snyk.io](https://app.snyk.io) → Account settings → Auth token |

## 2. Confirm GHCR + Cosign on the next main push

After push to **main**: Actions → Plane CI → docker-build (push + Cosign sign/verify hard) and Packages → `living-intermediate-control-plane`.

## 3. Enable plane-unattended.timer on the host

**Copy-paste block:** `docs/timer-copy-paste.md`

```bash
export PLANE_HOME="$HOME/living-intermediate-control-plane"
cd "$PLANE_HOME"
git pull --ff-only origin main

mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-unattended.service ~/.config/systemd/user/
cp docs/systemd/plane-unattended.timer   ~/.config/systemd/user/
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$PLANE_HOME|" ~/.config/systemd/user/plane-unattended.service

systemctl --user daemon-reload
systemctl --user enable --now plane-unattended.timer
loginctl enable-linger "$USER"
systemctl --user start plane-unattended.service
systemctl --user list-timers plane-unattended.timer
journalctl --user -u plane-unattended.service -n 50 --no-pager
```

Or: `npm run operator-host`

## 4. Optionally enable Gitsign

See `docs/gitsign.md`.

## 5. agent-chat only for workspace/ toolkit work

`plane agent-chat` when needed · `plane agent-revoke` to end · otherwise use `plane unattended` / `supply-chain` / `admit-change`.

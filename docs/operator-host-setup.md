# Operator host setup

Full next-ops checklist: **`docs/next-ops.md`**.

## Preferred schedule: unattended timer

```bash
mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-unattended.service ~/.config/systemd/user/
cp docs/systemd/plane-unattended.timer   ~/.config/systemd/user/
nano ~/.config/systemd/user/plane-unattended.service

systemctl --user daemon-reload
systemctl --user enable --now plane-unattended.timer
loginctl enable-linger $USER
systemctl --user start plane-unattended.service
```

Default: **09:15** daily. Do not also enable `plane-daily.timer`.

## Rekor (optional)

```bash
brew install rekor-cli
```

## Agent toolkit

Use `plane agent-chat` **only** when you need allowlisted tools writing under `workspace/`.  
Revoke with `plane agent-revoke`.

## Smoke

```bash
plane upgrade-check
plane supply-chain
plane unattended
plane progress
```

# Operator host setup

Timer **copy-paste:** `docs/timer-copy-paste.md`  
Full checklist: `docs/next-ops.md`

```bash
export PLANE_HOME="$HOME/living-intermediate-control-plane"
cd "$PLANE_HOME"

mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-unattended.service ~/.config/systemd/user/
cp docs/systemd/plane-unattended.timer   ~/.config/systemd/user/
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$PLANE_HOME|" ~/.config/systemd/user/plane-unattended.service

systemctl --user daemon-reload
systemctl --user enable --now plane-unattended.timer
loginctl enable-linger "$USER"
systemctl --user start plane-unattended.service
journalctl --user -u plane-unattended.service -n 50 --no-pager
```

Default schedule: **09:15**. Do not also enable `plane-daily.timer`.

```bash
npm run operator-host
```

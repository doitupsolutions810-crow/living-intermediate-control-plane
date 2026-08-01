# plane-unattended.timer — copy-paste commands

Run from a machine with **systemd --user** (typical Linux). Adjust `PLANE_HOME` if your clone path differs.

## One block (install + enable + smoke)

```bash
export PLANE_HOME="$HOME/living-intermediate-control-plane"
cd "$PLANE_HOME"
git pull --ff-only origin main

mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-unattended.service ~/.config/systemd/user/
cp docs/systemd/plane-unattended.timer   ~/.config/systemd/user/

# Optional: set absolute paths
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$PLANE_HOME|" ~/.config/systemd/user/plane-unattended.service
# If node is not /usr/bin/node, edit ExecStart:
# nano ~/.config/systemd/user/plane-unattended.service

systemctl --user daemon-reload
systemctl --user enable --now plane-unattended.timer
loginctl enable-linger "$USER"

systemctl --user start plane-unattended.service
systemctl --user list-timers plane-unattended.timer
systemctl --user status plane-unattended.timer --no-pager
journalctl --user -u plane-unattended.service -n 50 --no-pager
```

## Check status later

```bash
systemctl --user list-timers plane-unattended.timer
systemctl --user status plane-unattended.service --no-pager
journalctl --user -u plane-unattended.service -n 100 --no-pager
journalctl --user -u plane-unattended.service --since today --no-pager
```

## Run once now (without waiting for 09:15)

```bash
systemctl --user start plane-unattended.service
journalctl --user -u plane-unattended.service -n 50 --no-pager
```

## Disable / stop

```bash
systemctl --user disable --now plane-unattended.timer
systemctl --user stop plane-unattended.service
```

## Cron alternative (if no systemd user timers)

```bash
crontab -e
```

Add:

```cron
15 9 * * * cd $HOME/living-intermediate-control-plane && /usr/bin/node status/unattended.mjs >> $HOME/plane-unattended.log 2>&1
```

Use **either** systemd **or** cron — not both.

## Helper script

```bash
cd "$HOME/living-intermediate-control-plane"
npm run operator-host
```

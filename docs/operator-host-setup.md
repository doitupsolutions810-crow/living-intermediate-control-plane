# Operator host setup

**Preferred schedule:** unattended loop (includes daily + self-develop + admit-change + final gates).

## 0. Prerequisites

```bash
cd /path/to/living-intermediate-control-plane
git pull --ff-only origin main
plane upgrade-check
node -v   # >= 18
```

```bash
export PLANE_HOME="$HOME/living-intermediate-control-plane"
cd "$PLANE_HOME"
```

## 1. Rekor CLI (optional log queries)

```bash
brew install rekor-cli
plane rekor version
```

## 2. Host schedule — systemd (recommended)

Use **unattended** timer (not both daily and unattended).

```bash
mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-unattended.service ~/.config/systemd/user/
cp docs/systemd/plane-unattended.timer   ~/.config/systemd/user/

nano ~/.config/systemd/user/plane-unattended.service
# WorkingDirectory + ExecStart=/usr/bin/node status/unattended.mjs

systemctl --user daemon-reload
systemctl --user enable --now plane-unattended.timer
loginctl enable-linger $USER

systemctl --user start plane-unattended.service
journalctl --user -u plane-unattended.service -n 50 --no-pager
```

Default: daily **09:15** (`plane-unattended.timer`).

Daily-only units remain in `docs/systemd/plane-daily.*` if you prefer the lighter loop.

## 3. Cron alternative (single source)

Template: **`docs/cron/plane-daily.crontab`**

For unattended instead of daily, schedule:

```cron
15 9 * * * cd $HOME/living-intermediate-control-plane && /usr/bin/node status/unattended.mjs >> $HOME/plane-unattended.log 2>&1
```

Use **either** systemd **or** cron — not both.

## 4. Chat-authorized agent (optional on host)

```bash
ollama pull llama3.2
plane agent-chat    # authorize session
```

## 5. Smoke / admit

```bash
plane upgrade-check
plane supply-chain
plane unattended
plane admit-change
plane progress
```

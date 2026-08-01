# Operator host setup

Configure **systemd timer**, **cron**, and **rekor-cli** for the daily plane loop.

## 0. Prerequisites

```bash
cd /path/to/living-intermediate-control-plane
git pull --ff-only origin main
plane upgrade-check
node -v   # >= 18
```

Set this to your clone path (used below):

```bash
export PLANE_HOME="$HOME/living-intermediate-control-plane"
cd "$PLANE_HOME"
```

---

## 1. Rekor CLI installation

### Homebrew (macOS / Linux)

```bash
brew install rekor-cli
rekor-cli version
```

### Linux amd64 (curl)

```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-linux-amd64
chmod +x rekor-cli
sudo mv rekor-cli /usr/local/bin/rekor-cli
rekor-cli version
```

### Verify via plane

```bash
plane rekor version
# or
ALLOW_SKIP=0 npm run rekor:version
```

More OS options: `docs/cosign.md`.

---

## 2. Configure systemd timer (recommended on Linux)

### Install user units

```bash
mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-daily.service ~/.config/systemd/user/
cp docs/systemd/plane-daily.timer   ~/.config/systemd/user/
```

### Edit paths

```bash
nano ~/.config/systemd/user/plane-daily.service
```

Set at least:

```ini
WorkingDirectory=%h/living-intermediate-control-plane
ExecStart=/usr/bin/node status/daily-loop.mjs
```

If Node lives under nvm:

```ini
ExecStart=%h/.nvm/versions/node/v20.11.0/bin/node status/daily-loop.mjs
```

Optional environment:

```ini
Environment=DAILY_GATE_DOCTOR=1
Environment=DAILY_CONTINUE_ON_FAIL=1
```

### Enable

```bash
systemctl --user daemon-reload
systemctl --user enable --now plane-daily.timer
loginctl enable-linger $USER   # keep timer after logout

systemctl --user list-timers plane-daily.timer
systemctl --user start plane-daily.service
journalctl --user -u plane-daily.service -n 50 --no-pager
```

Sample units: `docs/systemd/plane-daily.service`, `docs/systemd/plane-daily.timer`  
Debug: `docs/systemd-debug.md`, `docs/jq-cheatsheet.md`

---

## 3. Add cron (alternative or extra)

### Crontab example (daily 09:00)

```bash
crontab -e
```

Add (adjust path and node):

```cron
0 9 * * * cd $HOME/living-intermediate-control-plane && /usr/bin/node status/daily-loop.mjs >> $HOME/plane-daily.log 2>&1
```

Or use the template:

```bash
# Review then install
cat docs/cron/plane-daily.crontab
crontab -l > /tmp/cron.bak 2>/dev/null || true
(crontab -l 2>/dev/null; cat docs/cron/plane-daily.crontab) | crontab -
crontab -l
```

### Prefer one scheduler

Use **either** systemd timer **or** cron for the daily loop, not both, unless you intentionally want double runs.

---

## 4. Helper script

```bash
./scripts/install-operator-host.sh
```

Prints paths, copies systemd units (if Linux), shows cron line, checks rekor-cli.

---

## 5. Smoke test

```bash
plane upgrade-check
plane daily
plane rekor version
cat data/daily-loop-last.json
```

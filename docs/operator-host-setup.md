# Operator host setup

Configure **systemd timer**, **cron**, and **rekor-cli** for the daily plane loop.

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

---

## 1. Rekor CLI installation

```bash
brew install rekor-cli
rekor-cli version
plane rekor version
```

Other platforms: `docs/cosign.md`.

---

## 2. systemd timer (recommended on Linux)

```bash
mkdir -p ~/.config/systemd/user
cp docs/systemd/plane-daily.service ~/.config/systemd/user/
cp docs/systemd/plane-daily.timer   ~/.config/systemd/user/

nano ~/.config/systemd/user/plane-daily.service
# Set WorkingDirectory and ExecStart (absolute node path if needed)

systemctl --user daemon-reload
systemctl --user enable --now plane-daily.timer
loginctl enable-linger $USER

systemctl --user start plane-daily.service
journalctl --user -u plane-daily.service -n 50 --no-pager
```

Units: `docs/systemd/` · Debug: `docs/systemd-debug.md`

---

## 3. Cron (alternative)

Canonical template only — do not duplicate lines elsewhere:

**`docs/cron/plane-daily.crontab`**

```bash
# Review, adjust paths, then:
crontab -e
# paste from docs/cron/plane-daily.crontab
```

Use **either** systemd timer **or** cron, not both.

---

## 4. Helper

```bash
npm run operator-host
```

---

## 5. Smoke test

```bash
plane upgrade-check
plane daily
plane rekor version
cat data/daily-loop-last.json
```

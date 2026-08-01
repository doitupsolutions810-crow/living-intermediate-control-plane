#!/usr/bin/env bash
# Operator host helper: systemd units, cron template, rekor-cli check
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANE_HOME="${PLANE_HOME:-$ROOT}"
USER_SYSTEMD="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

echo "PLANE_HOME=$PLANE_HOME"
echo

echo "== Rekor CLI =="
if command -v rekor-cli >/dev/null 2>&1; then
  rekor-cli version || true
else
  echo "rekor-cli not found."
  echo "  Homebrew: brew install rekor-cli"
  echo "  Linux:    see docs/cosign.md / docs/operator-host-setup.md"
fi
echo

echo "== systemd user units =="
if command -v systemctl >/dev/null 2>&1; then
  mkdir -p "$USER_SYSTEMD"
  cp "$ROOT/docs/systemd/plane-daily.service" "$USER_SYSTEMD/"
  cp "$ROOT/docs/systemd/plane-daily.timer" "$USER_SYSTEMD/"
  echo "Copied to $USER_SYSTEMD"
  echo "Edit WorkingDirectory/ExecStart if needed, then:"
  echo "  systemctl --user daemon-reload"
  echo "  systemctl --user enable --now plane-daily.timer"
  echo "  loginctl enable-linger \$USER"
else
  echo "systemctl not available — use cron instead."
fi
echo

echo "== cron template =="
echo "File: $ROOT/docs/cron/plane-daily.crontab"
echo "Example line:"
grep -v '^#' "$ROOT/docs/cron/plane-daily.crontab" | grep -v '^$' | head -5
echo
echo "Install example:"
echo "  (crontab -l 2>/dev/null; cat docs/cron/plane-daily.crontab) | crontab -"
echo
echo "Use either systemd timer OR cron for daily loop (not both)."
echo
echo "== smoke =="
echo "  cd \"$PLANE_HOME\" && node status/upgrade-check.mjs && node status/daily-loop.mjs"

#!/usr/bin/env bash
# Operator host helper: systemd units, point to cron template, rekor-cli check
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
  echo "rekor-cli not found. Install: brew install rekor-cli  (see docs/cosign.md)"
fi
echo

echo "== systemd user units =="
if command -v systemctl >/dev/null 2>&1; then
  mkdir -p "$USER_SYSTEMD"
  cp "$ROOT/docs/systemd/plane-daily.service" "$USER_SYSTEMD/"
  cp "$ROOT/docs/systemd/plane-daily.timer" "$USER_SYSTEMD/"
  echo "Copied to $USER_SYSTEMD"
  echo "Edit WorkingDirectory/ExecStart, then:"
  echo "  systemctl --user daemon-reload"
  echo "  systemctl --user enable --now plane-daily.timer"
else
  echo "systemctl not available — use cron template instead."
fi
echo

echo "== cron =="
echo "Canonical template: $ROOT/docs/cron/plane-daily.crontab"
echo "(Use either systemd timer or cron, not both.)"
echo
echo "== smoke =="
echo "  cd \"$PLANE_HOME\" && node status/upgrade-check.mjs && node status/daily-loop.mjs"

#!/usr/bin/env bash
# Prefer unattended timer; point at cron template; check rekor-cli
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANE_HOME="${PLANE_HOME:-$ROOT}"
USER_SYSTEMD="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

echo "PLANE_HOME=$PLANE_HOME"
echo

echo "== Rekor CLI (optional) =="
if command -v rekor-cli >/dev/null 2>&1; then
  rekor-cli version || true
else
  echo "Not installed. brew install rekor-cli  (optional)"
fi
echo

echo "== systemd: plane-unattended (preferred) =="
if command -v systemctl >/dev/null 2>&1; then
  mkdir -p "$USER_SYSTEMD"
  cp "$ROOT/docs/systemd/plane-unattended.service" "$USER_SYSTEMD/"
  cp "$ROOT/docs/systemd/plane-unattended.timer" "$USER_SYSTEMD/"
  echo "Copied plane-unattended.service/.timer to $USER_SYSTEMD"
  echo "Edit WorkingDirectory/ExecStart if needed, then:"
  echo "  systemctl --user daemon-reload"
  echo "  systemctl --user enable --now plane-unattended.timer"
  echo "  loginctl enable-linger \$USER"
  echo "  systemctl --user start plane-unattended.service"
  echo "  journalctl --user -u plane-unattended.service -n 50 --no-pager"
else
  echo "systemctl not available — use cron for unattended.mjs (see docs/next-ops.md)"
fi
echo

echo "== cron (alternative; single scheduler only) =="
echo "Canonical daily template: docs/cron/plane-daily.crontab"
echo "For unattended: 15 9 * * * cd \$HOME/living-intermediate-control-plane && node status/unattended.mjs >> \$HOME/plane-unattended.log 2>&1"
echo

echo "== SNYK_TOKEN / GHCR =="
echo "Set GitHub secret SNYK_TOKEN so CI Snyk never skips."
echo "Next main push: confirm GHCR package + Cosign sign/verify in Actions."
echo "See docs/next-ops.md"
echo

echo "== agent-chat policy =="
echo "Use plane agent-chat ONLY when you need toolkit writes under workspace/."
echo "Otherwise: plane unattended | supply-chain | admit-change"
echo

echo "== smoke =="
echo "  cd \"$PLANE_HOME\" && node status/upgrade-check.mjs && node status/progress.mjs"

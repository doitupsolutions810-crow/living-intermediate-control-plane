#!/usr/bin/env bash
set -euo pipefail
CFG="${CONTROL12_CF_CONFIG:-$HOME/.cloudflared/config.yml}"
if [[ ! -f "$CFG" ]]; then
  echo "missing config: $CFG (copy cloudflared/config.yml)" >&2
  exit 1
fi
# Refuse credentials-file inside a git repo path heuristic
if grep -q 'credentials-file:.*living-intermediate' "$CFG" 2>/dev/null; then
  echo "credentials-file must not live inside the repository" >&2
  exit 1
fi
exec cloudflared tunnel --config "$CFG" run

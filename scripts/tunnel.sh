#!/usr/bin/env bash
# Quick tunnel to local platform (trycloudflare).
set -euo pipefail
PORT="${CONTROL12_PLATFORM_PORT:-4400}"
if ! command -v cloudflared >/dev/null; then
  echo "install cloudflared first" >&2
  exit 1
fi
exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"

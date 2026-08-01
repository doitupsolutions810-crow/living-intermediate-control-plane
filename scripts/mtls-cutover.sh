#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/mtls-rotate.sh"
echo "1) kill -HUP <platform-pid> or POST /api/v1/security/tls/reload"
echo "2) restart cloudflared with new client cert"
echo "3) rm -f \$HOME/.control12-mtls/ca-previous.pem && HUP again"

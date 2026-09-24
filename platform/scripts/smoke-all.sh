#!/usr/bin/env bash
# Run the full lab smoke suite: dual-plane, two-node federation, negative link-sig.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> dual-plane-smoke"
node scripts/dual-plane-smoke.mjs

echo "==> federation-two-node-smoke"
bash scripts/federation-two-node-smoke.sh

echo "==> federation-link-sig-negative-smoke"
bash scripts/federation-link-sig-negative-smoke.sh

echo "==> unit: multi-belief + session-link"
node test/multi-belief.test.mjs
node test/session-link.test.mjs

echo "PASS: smoke-all"

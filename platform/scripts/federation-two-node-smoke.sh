#!/usr/bin/env bash
# Spin two lab platforms; publish from A; ingest on B.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A_PORT="${A_PORT:-4410}"
B_PORT="${B_PORT:-4411}"
A_STATE="/tmp/c12-fed-a-$$"
B_STATE="/tmp/c12-fed-b-$$"
cleanup() {
  kill "${A_PID:-}" "${B_PID:-}" 2>/dev/null || true
  rm -rf "$A_STATE" "$B_STATE"
}
trap cleanup EXIT

mkdir -p "$A_STATE/workspace" "$B_STATE/workspace"
CONTROL12_PLATFORM_PORT="$A_PORT" CONTROL12_CHAT_OPEN=1 CONTROL12_PLATFORM_ROOT="$A_STATE" \
  CONTROL12_CODE_WORKSPACE="$A_STATE/workspace" CONTROL12_FEDERATION_LABEL=node-a \
  node "$ROOT/src/server.mjs" >"$A_STATE/log" 2>&1 &
A_PID=$!
CONTROL12_PLATFORM_PORT="$B_PORT" CONTROL12_CHAT_OPEN=1 CONTROL12_PLATFORM_ROOT="$B_STATE" \
  CONTROL12_CODE_WORKSPACE="$B_STATE/workspace" CONTROL12_FEDERATION_LABEL=node-b \
  node "$ROOT/src/server.mjs" >"$B_STATE/log" 2>&1 &
B_PID=$!

for p in "$A_PORT" "$B_PORT"; do
  for _ in $(seq 1 40); do
    curl -fsS "http://127.0.0.1:$p/health" >/dev/null 2>&1 && break
    sleep 0.15
  done
done

DIGEST=$(curl -fsS -X POST "http://127.0.0.1:${A_PORT}/api/v1/federation/publish" \
  -H 'content-type: application/json' -d '{}')
echo "$DIGEST" | grep -q digest
curl -fsS -X POST "http://127.0.0.1:${B_PORT}/api/v1/federation/ingest" \
  -H 'content-type: application/json' \
  -d "$(node -pe 'const d=JSON.parse(process.argv[1]); JSON.stringify({peerId:"node-a",digest:d})' "$DIGEST")" \
  | grep -q ingestedAt
curl -fsS "http://127.0.0.1:${B_PORT}/api/v1/federation/snapshot" | grep -q node-a
echo "PASS: two-node federation"

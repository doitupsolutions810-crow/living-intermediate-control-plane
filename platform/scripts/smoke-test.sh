#!/usr/bin/env bash
# Live smoke against a running platform (or starts one briefly).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${CONTROL12_PLATFORM_PORT:-4499}"
STATE="${CONTROL12_PLATFORM_ROOT:-/tmp/c12-smoke-$$}"
BASE="http://127.0.0.1:${PORT}"
OWNED=0
cleanup() {
  if [[ "$OWNED" -eq 1 ]]; then
    kill "${PID:-}" 2>/dev/null || true
    rm -rf "$STATE"
  fi
}
trap cleanup EXIT

if ! curl -fsS "$BASE/health" >/dev/null 2>&1; then
  mkdir -p "$STATE/workspace"
  OWNED=1
  CONTROL12_PLATFORM_PORT="$PORT" \
  CONTROL12_CHAT_OPEN=1 \
  CONTROL12_PLATFORM_ROOT="$STATE" \
  CONTROL12_CODE_WORKSPACE="$STATE/workspace" \
    node "$ROOT/src/server.mjs" >"$STATE/server.log" 2>&1 &
  PID=$!
  for _ in $(seq 1 40); do
    curl -fsS "$BASE/health" >/dev/null 2>&1 && break
    sleep 0.15
  done
fi

curl -fsS "$BASE/health" | grep -q '"ok":true'
curl -fsS "$BASE/api/v1/security/status" | grep -q '"severity"'
curl -fsS "$BASE/api/v1/audio/spectrum" | grep -q 'partials'
curl -fsS -X POST "$BASE/api/v1/audio/tick" -H 'content-type: application/json' -d '{"belief":0.55}' | grep -q belief
SID=$(curl -fsS -X POST "$BASE/api/v1/chat/session" -H 'content-type: application/json' -d '{"belief":0.55}' | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).id')
curl -fsS -X POST "$BASE/api/v1/chat/turn" -H 'content-type: application/json' \
  -d "{\"sessionId\":\"$SID\",\"message\":\"smoke\"}" | grep -q systemAugment
# Publish before sensitive writes so anomaly heuristics do not block federation in lab smoke.
curl -fsS -X POST "$BASE/api/v1/federation/publish" -H 'content-type: application/json' -d '{}' | grep -q digest
curl -fsS -X POST "$BASE/api/v1/code/quorum" -H 'content-type: application/json' \
  -d '{"goal":"smoke","path":"smoke.txt","content":"ok\n"}' | grep -q CODING_QUORUM
curl -fsS "$BASE/api/v1/attestation/sbom" | grep -q CycloneDX
curl -fsS -X POST "$BASE/api/v1/cockpit/action" -H 'content-type: application/json' \
  -d '{"action":"spectrum"}' | grep -q action
echo "PASS: platform smoke"

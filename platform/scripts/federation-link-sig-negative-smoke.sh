#!/usr/bin/env bash
# Negative path: CONTROL12_REQUIRE_LINK_SIG=1 must reject bad session links on ingest.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${NEG_PORT:-4412}"
STATE="/tmp/c12-fed-neg-$$"
HMAC_KEY="${CONTROL12_ATTEST_HMAC_KEY:-neg-smoke-hmac}"
cleanup() {
  kill "${PID:-}" 2>/dev/null || true
  rm -rf "$STATE"
}
trap cleanup EXIT

mkdir -p "$STATE/workspace" "$STATE/state"
CONTROL12_PLATFORM_PORT="$PORT" CONTROL12_CHAT_OPEN=1 CONTROL12_PLATFORM_ROOT="$STATE" \
  CONTROL12_CODE_WORKSPACE="$STATE/workspace" CONTROL12_FEDERATION_LABEL=neg \
  CONTROL12_ATTEST_HMAC_KEY="$HMAC_KEY" CONTROL12_REQUIRE_LINK_SIG=1 \
  node "$ROOT/src/server.mjs" >"$STATE/log" 2>&1 &
PID=$!

for _ in $(seq 1 50); do
  curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.15
done
curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null

DIGEST='{"digest":"neg-digest","belief":0.5,"meanBelief":0.5,"tension":0.25,"multiBeliefDigest":"neg-mb"}'
BAD_LINK='{"schema":"control12.attestation-session-link/v1","at":"2026-01-01T00:00:00.000Z","latticeRoot":"avrone-duekrey","sessionId":"bad","turnId":null,"sbomSha256":null,"observationSha256":null,"multiBeliefDigest":null,"meanBelief":null,"nodeCount":null,"linkDigest":"deadbeef","signature":"cafebabe","signed":true}'

CODE=$(curl -sS -o /tmp/neg-ingest.json -w '%{http_code}' -X POST "http://127.0.0.1:${PORT}/api/v1/federation/ingest" \
  -H 'content-type: application/json' \
  -d "{\"peerId\":\"attacker\",\"digest\":$DIGEST,\"sessionLink\":$BAD_LINK}")

if [[ "$CODE" != "403" ]]; then
  echo "FAIL: expected 403, got $CODE body=$(cat /tmp/neg-ingest.json)"
  exit 1
fi
grep -q 'session link verification failed' /tmp/neg-ingest.json

GOOD=$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/cockpit/action" \
  -H 'content-type: application/json' \
  -d '{"action":"attestation_link","sessionId":"good-neg","latticeObservation":"ok"}')
LINK_JSON=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(j.result||j));' "$GOOD")
BODY=$(node -e 'const d=JSON.parse(process.argv[1]); const l=JSON.parse(process.argv[2]); process.stdout.write(JSON.stringify({peerId:"honest",digest:d,sessionLink:l}));' "$DIGEST" "$LINK_JSON")
curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/federation/ingest" \
  -H 'content-type: application/json' -d "$BODY" | grep -q ingestedAt

echo "PASS: negative link-sig smoke (403 bad, 200 good)"

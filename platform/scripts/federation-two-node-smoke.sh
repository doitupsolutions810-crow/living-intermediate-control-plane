#!/usr/bin/env bash
# Two lab platforms: consensus + multi-belief publish + signed session link ingest + graph merge.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A_PORT="${A_PORT:-4410}"
B_PORT="${B_PORT:-4411}"
A_STATE="/tmp/c12-fed-a-$$"
B_STATE="/tmp/c12-fed-b-$$"
HMAC_KEY="${CONTROL12_ATTEST_HMAC_KEY:-fed-smoke-hmac-lab}"
cleanup() {
  kill "${A_PID:-}" "${B_PID:-}" 2>/dev/null || true
  rm -rf "$A_STATE" "$B_STATE"
}
trap cleanup EXIT

mkdir -p "$A_STATE/workspace" "$B_STATE/workspace" "$A_STATE/state" "$B_STATE/state"
CONTROL12_PLATFORM_PORT="$A_PORT" CONTROL12_CHAT_OPEN=1 CONTROL12_PLATFORM_ROOT="$A_STATE" \
  CONTROL12_CODE_WORKSPACE="$A_STATE/workspace" CONTROL12_FEDERATION_LABEL=node-a \
  CONTROL12_ATTEST_HMAC_KEY="$HMAC_KEY" \
  node "$ROOT/src/server.mjs" >"$A_STATE/log" 2>&1 &
A_PID=$!
CONTROL12_PLATFORM_PORT="$B_PORT" CONTROL12_CHAT_OPEN=1 CONTROL12_PLATFORM_ROOT="$B_STATE" \
  CONTROL12_CODE_WORKSPACE="$B_STATE/workspace" CONTROL12_FEDERATION_LABEL=node-b \
  CONTROL12_ATTEST_HMAC_KEY="$HMAC_KEY" \
  node "$ROOT/src/server.mjs" >"$B_STATE/log" 2>&1 &
B_PID=$!

for p in "$A_PORT" "$B_PORT"; do
  for _ in $(seq 1 50); do
    curl -fsS "http://127.0.0.1:$p/health" >/dev/null 2>&1 && break
    sleep 0.15
  done
  curl -fsS "http://127.0.0.1:$p/health" >/dev/null
done

curl -fsS -X POST "http://127.0.0.1:${A_PORT}/api/v1/belief/graph/consensus" \
  -H 'content-type: application/json' -d '{"scale":0.05}' >/dev/null

DIGEST=$(curl -fsS -X POST "http://127.0.0.1:${A_PORT}/api/v1/cockpit/action" \
  -H 'content-type: application/json' \
  -d '{"action":"multi_belief_publish"}')
echo "$DIGEST" | grep -q '"digest"'
DIGEST_JSON=$(node -e '
  const j=JSON.parse(process.argv[1]);
  const d=j.result||j;
  if(!d.digest) process.exit(1);
  process.stdout.write(JSON.stringify(d));
' "$DIGEST")

LINK=$(curl -fsS -X POST "http://127.0.0.1:${A_PORT}/api/v1/cockpit/action" \
  -H 'content-type: application/json' \
  -d '{"action":"attestation_link","sessionId":"fed-smoke-sess","latticeObservation":"two-node"}')
LINK_JSON=$(node -e '
  const j=JSON.parse(process.argv[1]);
  const l=j.result||j;
  if(!l.linkDigest) process.exit(1);
  process.stdout.write(JSON.stringify(l));
' "$LINK")

INGEST_BODY=$(node -e '
  const digest=JSON.parse(process.argv[1]);
  const sessionLink=JSON.parse(process.argv[2]);
  process.stdout.write(JSON.stringify({ peerId: "node-a", digest, sessionLink }));
' "$DIGEST_JSON" "$LINK_JSON")

INGEST=$(curl -fsS -X POST "http://127.0.0.1:${B_PORT}/api/v1/federation/ingest" \
  -H 'content-type: application/json' \
  -d "$INGEST_BODY")
echo "$INGEST" | grep -q ingestedAt
echo "$INGEST" | grep -q graphMerge
echo "$INGEST" | grep -q linkVerification

node -e '
  const j=JSON.parse(process.argv[1]);
  if(!j.linkVerification || j.linkVerification.ok!==true) {
    console.error("linkVerification failed", j.linkVerification);
    process.exit(1);
  }
' "$INGEST"

curl -fsS "http://127.0.0.1:${B_PORT}/api/v1/federation/snapshot" | grep -q node-a
GRAPH=$(curl -fsS "http://127.0.0.1:${B_PORT}/api/v1/belief/graph")
echo "$GRAPH" | grep -q node-a

STATUS_A=$(curl -fsS "http://127.0.0.1:${A_PORT}/api/v1/security/status")
echo "$STATUS_A" | grep -q consensus

echo "PASS: two-node federation (consensus + signed link + graph merge)"

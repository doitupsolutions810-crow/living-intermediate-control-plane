#!/usr/bin/env bash
# Lab mTLS rotate with dual-CA overlap (ca-previous.pem).
set -euo pipefail
DIR="${CONTROL12_MTLS_DIR:-$HOME/.control12-mtls}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAYS="${CONTROL12_MTLS_DAYS:-825}"
mkdir -p "$DIR" && chmod 700 "$DIR"
STAGE="$DIR/stage-$STAMP"
mkdir -p "$STAGE"

openssl genrsa -out "$STAGE/ca.key" 4096
openssl req -x509 -new -nodes -key "$STAGE/ca.key" -sha256 -days "$DAYS" -out "$STAGE/ca.pem" \
  -subj "/CN=living-intermediate-ca-$STAMP"
openssl genrsa -out "$STAGE/server.key" 2048
openssl req -new -key "$STAGE/server.key" -out "$STAGE/server.csr" -subj "/CN=control12-platform.local"
openssl x509 -req -in "$STAGE/server.csr" -CA "$STAGE/ca.pem" -CAkey "$STAGE/ca.key" -CAcreateserial \
  -out "$STAGE/server.pem" -days "$DAYS" -sha256
openssl genrsa -out "$STAGE/client.key" 2048
openssl req -new -key "$STAGE/client.key" -out "$STAGE/client.csr" -subj "/CN=cloudflared-origin"
openssl x509 -req -in "$STAGE/client.csr" -CA "$STAGE/ca.pem" -CAkey "$STAGE/ca.key" -CAcreateserial \
  -out "$STAGE/client.pem" -days "$DAYS" -sha256
chmod 600 "$STAGE"/*.key
openssl verify -CAfile "$STAGE/ca.pem" "$STAGE/server.pem"
openssl verify -CAfile "$STAGE/ca.pem" "$STAGE/client.pem"

if [[ -f "$DIR/ca.pem" ]]; then
  cp -a "$DIR/ca.pem" "$DIR/ca-previous.pem"
fi
for f in ca.pem ca.key server.pem server.key client.pem client.key; do
  cp -a "$STAGE/$f" "$DIR/$f"
done
rm -rf "$STAGE"
echo "rotated $DIR — reload platform TLS, restart cloudflared, then drop ca-previous when healthy"

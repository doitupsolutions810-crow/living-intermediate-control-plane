#!/usr/bin/env bash
set -Eeuo pipefail
: "${RUNNER_URL:?RUNNER_URL is required}"
RUNNER_TOKEN="$(cat)"
if [[ -z "$RUNNER_TOKEN" ]]; then echo "Registration token missing on stdin" >&2; exit 1; fi
: "${RUNNER_NAME:?RUNNER_NAME is required}"
RUNNER_LABELS="${RUNNER_LABELS:-great-scale,linux,x64}"
cd /home/runner
./config.sh \
  --url "$RUNNER_URL" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work _work \
  --unattended \
  --ephemeral \
  --disableupdate
unset RUNNER_TOKEN
exec ./run.sh

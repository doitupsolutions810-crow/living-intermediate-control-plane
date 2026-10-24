#!/usr/bin/env bash
set -Eeuo pipefail
: "\${RUNNER_URL:?RUNNER_URL is required}"
: "\${RUNNER_TOKEN:?RUNNER_TOKEN is required}"
: "\${RUNNER_NAME:?RUNNER_NAME is required}"
RUNNER_LABELS="\${RUNNER_LABELS:-great-scale,linux,x64}"
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

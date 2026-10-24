#!/usr/bin/env bash
set -Eeuo pipefail
: "${GH_RUNNER_PAT:?Set GH_RUNNER_PAT in the root-only runner environment file}"
: "${GH_REPOSITORY:?Set GH_REPOSITORY as owner/repository}"
GH_RUNNER_LABELS="${GH_RUNNER_LABELS:-great-scale,linux,x64}"
RUNNER_IMAGE="${RUNNER_IMAGE:-great-scale-runner:local}"
API="https://api.github.com/repos/$GH_REPOSITORY/actions/runners/registration-token"
log() { printf '[great-scale-runner] %s\n' "$*" >&2; }
while true; do
  log "Requesting an ephemeral runner registration token for $GH_REPOSITORY"
  if TOKEN="$(curl -fsSL --retry 3 --retry-delay 2 \
      -X POST \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $GH_RUNNER_PAT" \
      -H 'X-GitHub-Api-Version: 2022-11-28' \
      "$API" | jq -er '.token')"; then
    NAME="great-scale-$(hostname -s)-$(date +%s)"
    log "Starting isolated ephemeral runner $NAME"
    set +e
    docker run --rm \
      --name "$NAME" \
      --label great-scale.ephemeral=true \
      --env RUNNER_URL="https://github.com/$GH_REPOSITORY" \
      --env RUNNER_TOKEN="$TOKEN" \
      --env RUNNER_NAME="$NAME" \
      --env RUNNER_LABELS="$GH_RUNNER_LABELS" \
      "$RUNNER_IMAGE"
    RC=$?
    set -e
    unset TOKEN
    log "Ephemeral runner exited with code $RC; next registration will use a fresh token"
  else
    log "Could not obtain registration token; check PAT permissions, network, and repository name"
  fi
  sleep 5
done

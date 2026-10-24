#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo: sudo bash .github/runner/install-ubuntu.sh" >&2
  exit 1
fi
if [[ ! -f .github/runner/Dockerfile || ! -f .github/runner/supervisor.sh ]]; then
  echo "Run this script from the repository root after checking out the desired branch." >&2
  exit 1
fi
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo "This bootstrap currently supports Ubuntu/Debian x86_64 hosts only." >&2
  exit 1
fi
if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get is required; use an Ubuntu/Debian host." >&2
  exit 1
fi
REPOSITORY="${GH_REPOSITORY:-doitupsolutions810-crow/living-intermediate-control-plane}"
LABELS="${GH_RUNNER_LABELS:-great-scale,linux,x64}"
apt-get update
apt-get install -y ca-certificates curl docker.io jq
systemctl enable --now docker
if [[ -z "${GH_RUNNER_PAT:-}" ]]; then
  read -r -s -p "Fine-grained GitHub PAT with repository Administration: write for $REPOSITORY: " GH_RUNNER_PAT
  printf '\n'
fi
if [[ -z "$GH_RUNNER_PAT" ]]; then
  echo "A token is required to register ephemeral runners." >&2
  exit 1
fi
install -d -m 0700 /etc/great-scale-runner
umask 077
cat > /etc/great-scale-runner/runner.env <<EOF
GH_RUNNER_PAT=$GH_RUNNER_PAT
GH_REPOSITORY=$REPOSITORY
GH_RUNNER_LABELS=$LABELS
EOF
unset GH_RUNNER_PAT
docker build --pull -t great-scale-runner:local -f .github/runner/Dockerfile .github/runner
install -o root -g root -m 0750 .github/runner/supervisor.sh /usr/local/sbin/great-scale-runner-supervisor
install -o root -g root -m 0644 .github/runner/great-scale-runner.service /etc/systemd/system/great-scale-runner.service
systemctl daemon-reload
systemctl enable --now great-scale-runner.service
echo "Runner supervisor installed and enabled at boot."
echo "Inspect logs with: sudo journalctl -u great-scale-runner.service -f"
echo "Check runner registration under repository Settings > Actions > Runners."

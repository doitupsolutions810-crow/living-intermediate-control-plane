#!/usr/bin/env bash
# Lab AVRONE stack with lattice observe on route.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"
export ALLOW_AGENT_EXECUTION="${ALLOW_AGENT_EXECUTION:-true}"
export LATTICE_OBSERVE_ON_ROUTE="${LATTICE_OBSERVE_ON_ROUTE:-1}"
export CONTROL12_PLATFORM_URL="${CONTROL12_PLATFORM_URL:-http://127.0.0.1:4400}"
export AVRONE_STACK_HOST="${AVRONE_STACK_HOST:-127.0.0.1}"
export AVRONE_STACK_PORT="${AVRONE_STACK_PORT:-8000}"

cd "$ROOT"
if [[ -x .venv/bin/python ]]; then
  PY=.venv/bin/python
else
  PY=python3
fi
exec "$PY" -m avrone_stack

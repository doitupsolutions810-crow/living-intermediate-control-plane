# AVRONE Python stack \u2194 Living Intermediate lattice

Dual-plane integration. Neither plane claims completion; both remain gated.

## Planes

| Plane | Runtime | Default port | Gate |
|-------|---------|--------------|------|
| Living intermediate | Node (`platform/src/server.mjs`) | 4400 | `CONTROL12_CHAT_OPEN`, `CONTROL12_CODE_REQUIRE_QUORUM`, mTLS |
| AVRONE production stack | Python FastAPI (Layers 6\u201316) | 8000 | `ALLOW_AGENT_EXECUTION=true` |

## Bridge modules

**Node (this repo)**

- `platform/src/bridge/lattice-observation.mjs` \u2014 builds `control12.lattice-observation/v1`
- `platform/src/bridge/avrone-stack-adapter.mjs` \u2014 calls AVRONE `/v1/chat/completions` with lattice system context

**Python (this repo, optional package)**

- `platform/python-bridge/avrone_bridge/lattice_client.py` \u2014 pulls `/api/v1/security/status`, spectrum, federation
- `platform/python-bridge/avrone_bridge/react_lattice.py` \u2014 attaches observation to ReAct `ReasoningTrace`

## Endpoints (Node plane)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/bridge/lattice/observe` | Structured + ReAct observation |
| GET | `/api/v1/bridge/avrone-stack/probe` | Reachability of Python stack |
| POST | `/api/v1/bridge/avrone-stack/route` | Route message through AVRONE with lattice context |

Query params for observe: `belief`, `session_id`, `node_id`.

## Environment

```bash
# Node plane
export CONTROL12_PLATFORM_PORT=4400
export AVRONE_STACK_URL=http://127.0.0.1:8000
export AVRONE_STACK_TOKEN=   # optional

# Python AVRONE stack
export CONTROL12_PLATFORM_URL=http://127.0.0.1:4400
export CONTROL12_PLATFORM_TOKEN=
export ALLOW_AGENT_EXECUTION=true   # required for real agent runs
export LATTICE_OBSERVE_ON_ROUTE=1
```

## Data flow (provisional)

1. Operator or Avrone chat issues a turn.
2. Node builds lattice observation (belief, tension $T=B(1-B)$, security, spectrum, federation digest).
3. Observation is injected as system context (and optionally as a ReAct step).
4. AVRONE swarm / LangGraph supervisor routes under its own execution gate.
5. Evidence remains separate: Node attestation digests + AVRONE training export / capability policy.

## Safety bounds

- Node code/terminal paths still use `execution-policy.mjs` (path escape reject, write cap, command blocklist).
- Python tools still call `settings.require_execution_gate()`.
- Bridge does not open either gate; it only exchanges observations and optional routed completions.
- mTLS and quorum profiles are unchanged (`production.env.example`).

## Smoke

```bash
# Node unit (no network)
node platform/test/bridge-observation.test.mjs

# With platform up
curl -s "http://127.0.0.1:4400/api/v1/bridge/lattice/observe?belief=0.55" | jq .
curl -s "http://127.0.0.1:4400/api/v1/bridge/avrone-stack/probe" | jq .
```

## Next moves (not claimed done)

1. Wire `attach_lattice_observation` into AVRONE `swarm.route` when `LATTICE_OBSERVE_ON_ROUTE=1`.
2. Publish observation digests into federation (belief+spectrum only).
3. Cockpit action `avrone_stack_route` for operator-triggered dual-plane turns.
4. Shared attestation key linking Node SBOM to AVRONE training export session ids.

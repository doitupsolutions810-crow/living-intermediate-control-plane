# Advancement stage — 2026-09-23

## Verified locally (`dual-plane-smoke.mjs` ok:true)

| Check | Status |
|-------|--------|
| health_node / health_py | 200 |
| bridge probe / route | 200 |
| observation_publish | 200 |
| attestation_link | 200 |
| avrone_stack_route (sealed) | 200 |
| jacobian_outcome | 200 |

## New surfaces

- `MultiBeliefGraph` — `GET /api/v1/belief/graph`, `POST …/step`, `POST …/node`
- Cockpit `jacobian_outcome` — soft $T=B(1-B)$ belief update
- Cockpit `avrone_stack_route` auto-seals attestation + observation digest
- `platform/scripts/dual-plane-smoke.mjs`

## Gates unchanged

- Node: `CONTROL12_CHAT_OPEN`, quorum, mTLS
- Python: `ALLOW_AGENT_EXECUTION`
- Production profile still strict

## Run

```bash
node platform/scripts/dual-plane-smoke.mjs
```

Provisional. Always another perspective.

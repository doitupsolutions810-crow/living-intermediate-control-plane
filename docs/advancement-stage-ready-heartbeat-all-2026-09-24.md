# Advancement — /ready + heartbeat all

## Verified

- dual-plane-smoke: readiness 200, heartbeat 200, heartbeat_all 200, ok:true
- multi-belief.test.mjs PASS (heartbeatAll)

## Chat commands

| Command | Effect |
|---------|--------|
| `/ready` | Print readiness snapshot |
| `/heartbeat <peerId> [belief]` | Single peer pulse |
| `/heartbeat` or `/heartbeat *` | Batch pulse all federated peers |
| `/consensus` / `/prune` / `/seal` | Unchanged |

## API

`POST /api/v1/belief/graph/heartbeat` with `{ "all": true }` → `heartbeatAll()`

Provisional. Always another perspective.

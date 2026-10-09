# Advancement — scheduled heartbeat + readiness severity color

## Verified

- dual-plane-smoke: readiness 200, heartbeat 200, heartbeat_all 200, ok:true
- multi-belief.test.mjs PASS

## Env

| Variable | Role |
|----------|------|
| CONTROL12_HEARTBEAT_MS | Interval for heartbeatAll (0 = off) |
| CONTROL12_HEARTBEAT_ANCHORS=1 | Also pulse local/avrone on schedule |
| CONTROL12_CONSENSUS_MS | Soft consensus timer |
| CONTROL12_PRUNE_MS | Stale peer prune timer |

## Strip

Readiness badge uses severity color: ok (green), warn/medium (warn), high/critical (bad).

## Chat

`/ready` · `/heartbeat` · `/heartbeat *` · `/heartbeat id` · `/consensus` · `/prune` · `/seal`

Provisional. Always another perspective.

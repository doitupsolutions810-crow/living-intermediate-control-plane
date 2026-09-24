# Advancement — peer heartbeat + readiness

## Verified

`bash platform/scripts/smoke-all.sh` → **PASS: smoke-all**

## APIs

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/readiness` | Aggregate gates, lattice, consensus, lastPrune, smoke script names |
| POST | `/api/v1/belief/graph/heartbeat` | `{ peerId, belief? }` refresh lastSeen |
| cockpit | `peer_heartbeat` | Same as heartbeat |

Heartbeat does not run soft consensus; it only keeps a peer alive for prune purposes.

Provisional. Always another perspective.

# Advancement — quiet peers + heartbeat strip

## Verified

- dual-plane-smoke: quiet_peers, timers_wired, last_heartbeat, heartbeat_all **200**, ok:true
- multi-belief.test.mjs PASS (quietPeers)

## Env

| Variable | Role |
|----------|------|
| CONTROL12_REQUIRE_HEARTBEAT_MS | Max age for quiet check; if set and quiet peers exist, readiness severity soft-bumps to `warn` |
| CONTROL12_PEER_MAX_AGE_MS | Fallback max age (also used by prune) |
| CONTROL12_HEARTBEAT_MS | Scheduled heartbeatAll |

## Strip

`hb: <time> · quiet N` next to prune.

Soft warning only — does not open or close execution gates.

Provisional. Always another perspective.

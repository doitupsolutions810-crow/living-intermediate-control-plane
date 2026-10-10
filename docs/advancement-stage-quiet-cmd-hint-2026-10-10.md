# Advancement — /quiet + warn auto-hint

## Verified

- dual-plane-smoke: quiet_peers, cockpit_quiet, last_heartbeat, readiness **200**, ok:true
- multi-belief.test.mjs PASS

## Operator

| Command | Effect |
|---------|--------|
| `/quiet` | List quiet federated peers (cockpit `quiet_peers`) |
| `/heartbeat *` | Pulse peers to clear quiet |
| `/ready` | Readiness snapshot |

## Auto-hint

When readiness severity is `warn`/`warning` and `quietPeers.count > 0`, chat posts a one-time hint suggesting `/heartbeat *` or `/quiet`.

Soft observation only — does not change execution gates.

Provisional. Always another perspective.

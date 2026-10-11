# Operator Dashboard

## URL

With platform running:

- `http://127.0.0.1:4400/dashboard`
- `http://127.0.0.1:4400/ops`

Optional: `?url=https://your-platform-host` to point the SPA at another origin.

## Panels

| Panel | Source |
|-------|--------|
| Readiness | `GET /api/v1/readiness` + `/health` |
| Lattice belief | readiness lattice + belief graph + sparkline |
| Great Scale | `GET /api/v1/scale/state` |
| Presence | lastHeartbeat, quietPeers, consensus, prune |
| Timers | readiness.timers |
| Security | severity + `/api/v1/security/status` |

## Actions (cockpit)

Scale state/step · Heartbeat * · Consensus · Prune · Quiet list

## File

`platform/public/dashboard.html` — served by `server.mjs`

Provisional. Always another perspective.

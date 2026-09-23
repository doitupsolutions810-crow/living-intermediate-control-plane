# Advancement — chat commands + two-node signed federation smoke

## Verified

- `bash platform/scripts/federation-two-node-smoke.sh` → **PASS**
- `node platform/scripts/dual-plane-smoke.mjs` → **ok: true**

## Chat operator commands

| Command | Action |
|---------|--------|
| `/seal` / `/sealed [msg]` | Sealed avrone_stack_route |
| `/consensus` | soft_consensus |
| `/prune` | prune_peers |

## Strip telemetry

- fed peers
- consensus μ @ time
- prune: N @ time

Provisional. Always another perspective.

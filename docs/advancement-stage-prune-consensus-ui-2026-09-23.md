# Advancement — scheduled prune, consensus digests, cockpit controls

## Verified

`node platform/scripts/dual-plane-smoke.mjs` → `ok: true`

## Env

| Variable | Role |
|----------|------|
| CONTROL12_CONSENSUS_MS | Soft consensus timer (0 = off) |
| CONTROL12_CONSENSUS_SCALE | Default 0.05 |
| CONTROL12_PRUNE_MS | Stale-peer prune timer (0 = off) |
| CONTROL12_PEER_MAX_AGE_MS | Default 24h |
| CONTROL12_ATTEST_HMAC_KEY | Session-link HMAC |
| CONTROL12_REQUIRE_LINK_SIG | Enforce link verify on ingest |

## Chat cockpit

- Seal route / `/seal`
- Consensus now
- Prune peers
- Badges: fed peers, consensus μ

Provisional. Always another perspective.

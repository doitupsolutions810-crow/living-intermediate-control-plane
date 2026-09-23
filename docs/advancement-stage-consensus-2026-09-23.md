# Advancement stage — soft consensus + signed links (2026-09-23)

## Verified (`dual-plane-smoke.mjs` ok:true)

- consensus (POST /api/v1/belief/graph/consensus)
- signed_link (attestation_link with multiBeliefDigest + HMAC when CONTROL12_ATTEST_HMAC_KEY set)
- federated peer count on security/status

## Env

| Variable | Role |
|----------|------|
| CONTROL12_CONSENSUS_MS | Timer interval for softConsensus (0 = off) |
| CONTROL12_CONSENSUS_SCALE | Step scale (default 0.05) |
| CONTROL12_ATTEST_HMAC_KEY | HMAC seal for session links |

## Chat UI

- Badge: **fed peers: N**
- Commands: `/seal`, `/sealed [msg]`

Provisional. Always another perspective.

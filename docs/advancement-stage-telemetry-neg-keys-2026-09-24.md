# Advancement — telemetry persist, negative link-sig, keyboard shortcuts

## Verified

| Check | Result |
|-------|--------|
| federation-link-sig-negative-smoke.sh | PASS (403 bad / 200 good) |
| federation-two-node-smoke.sh | PASS |
| telemetry.json after consensus+prune | PASS |
| dual-plane-smoke.mjs | ok:true |

## Persistence

- `state/belief-graph.json` — multi-belief graph
- `state/telemetry.json` — `lastConsensus`, `lastPrune`

## Keyboard (chat)

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+Shift+S | Seal route |
| Ctrl/Cmd+Shift+C | Consensus |
| Ctrl/Cmd+Shift+P | Prune peers |

## Env

`CONTROL12_REQUIRE_LINK_SIG=1` rejects failed session links on federation ingest.

Provisional. Always another perspective.

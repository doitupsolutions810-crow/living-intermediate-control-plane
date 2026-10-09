# MultiBeliefGraph (local platform)

Methods (lab):

- `upsertNode` / `addEdge` / `stepAll` / `jointSpectrum`
- `applyOutcome` — edge weight soft update
- `saveTo` / `loadFrom` — `state/belief-graph.json`
- `mergeFederatedPeer` — ingest path
- `softConsensus` — mean pull; refreshes `lastSeen`
- `pruneStalePeers` — drop quiet federated peers
- `heartbeat(peerId)` — presence without consensus
- `heartbeatAll` — batch pulse federated peers
- `federatedPeerCount` / `digest`

## Scheduled timers (server)

| Env | Effect |
|-----|--------|
| CONTROL12_CONSENSUS_MS | softConsensus loop |
| CONTROL12_PRUNE_MS | pruneStalePeers loop |
| CONTROL12_HEARTBEAT_MS | heartbeatAll loop |
| CONTROL12_HEARTBEAT_ANCHORS=1 | include local/avrone in scheduled heartbeat |

Telemetry: `state/telemetry.json` holds `lastConsensus`, `lastPrune`, `lastHeartbeat`.

Provisional.

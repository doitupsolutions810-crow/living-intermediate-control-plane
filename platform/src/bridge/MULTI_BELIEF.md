# MultiBeliefGraph (local platform)

Methods (lab):

- `upsertNode` / `addEdge` / `stepAll` / `jointSpectrum`
- `applyOutcome` — edge weight soft update
- `saveTo` / `loadFrom` — `state/belief-graph.json`
- `mergeFederatedPeer` — ingest path
- `softConsensus` — mean pull; refreshes `lastSeen`
- `pruneStalePeers` — drop quiet federated peers
- `heartbeat(peerId)` — presence without consensus
- `federatedPeerCount` / `digest`

Remote clones should sync this module from the living workspace when advancing beyond basic graph digests.

Provisional.

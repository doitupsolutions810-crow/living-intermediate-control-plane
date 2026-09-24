# Advancement — smoke-all + lastSeen on consensus

## Verified

```bash
bash platform/scripts/smoke-all.sh
# PASS: smoke-all
```

Includes:

1. dual-plane-smoke.mjs
2. federation-two-node-smoke.sh
3. federation-link-sig-negative-smoke.sh
4. multi-belief + session-link unit tests

## Behavior note

`softConsensus` refreshes `lastSeen` on participating nodes so active peers are less likely to be pruned while the lattice is averaging.

Provisional. Always another perspective.

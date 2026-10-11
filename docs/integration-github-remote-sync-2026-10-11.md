# Integration — GitHub living-intermediate-control-plane ↔ local lattice

Repo: https://github.com/doitupsolutions810-crow/living-intermediate-control-plane  
(alias / typo resolution: *interdemeiate-living-control-plane* → this repo)

## Coherent split

| Layer | Source of truth (provisional) |
|-------|-------------------------------|
| Platform lattice (multi-belief, heartbeat, quietPeers, great-scale, scale APIs) | Local workspace advances — push to GitHub |
| Operator loop (integrate.mjs, LaunchDesk, status/*, bin/plane) | GitHub remote — present in both |
| Avrone chat / agents / attestation / federation | Shared tree |

## Identity preserved

```
heat(h) = h(1-h)  ≡  tension(B) = B(1-B)
```

## Live readiness bridge

```bash
node lattice/readiness-poller.mjs
CONTROL12_PLATFORM_URL=http://127.0.0.1:4400 node lattice/readiness-poller.mjs live
```

## LaunchDesk evolve + scale

`launchdesk/actions.mjs` → `evolveViaPlatform()` posts cockpit `scale_step` when platform URL is set.

## Verify

```bash
cd platform && node test/great-scale.test.mjs && node test/multi-belief.test.mjs
node scripts/dual-plane-smoke.mjs
bash scripts/smoke-all.sh
```

Provisional. Always another perspective.

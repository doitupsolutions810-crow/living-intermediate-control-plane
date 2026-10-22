# Integration — Great Scale ↔ Living Intermediate

## Repos

| Repo | Role |
|------|------|
| [great-scale](https://github.com/doitupsolutions810-crow/great-scale) | Phase-time geometry UI (Watch/Observer/Forward/Adjacent/Down) |
| living-intermediate-control-plane | Belief Jacobian, federation, readiness, agents |

## Coherent identity (provisional)

```
heat(h) = h(1-h)  ≡  tension(B) = B(1-B)
```

| Great Scale | Lattice |
|-------------|---------|
| h (phase height) | belief B |
| S = heat(h) | tension T |
| zero-mode φ | spectral / mean coupling |
| cone √5−2 floor | Ψ ≥ CONE |
| residual 4+3+1 | partition of residual modes |

## Platform APIs

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/scale/state?belief=&view=` | Bridge snapshot |
| POST | `/api/v1/scale/step` | Soft belief step from scale map |
| cockpit | `scale_state` / `scale_step` | Same |

The platform health response includes a `scale` snapshot derived from the current live belief. The mounted state endpoint returns the bridge snapshot plus live lattice state.

The step endpoint updates the local belief through the phase-time scale map and returns the resulting frame. Federation publication is a separate operation; this endpoint does not claim to create a remote peer.

## Live geometry UI

https://great-scale.vercel.app

## Verify

```bash
cd platform && npm test
node platform/scripts/dual-plane-smoke.mjs  # scale_state and scale_step contracts
```

Source wiring and tests do not prove a live deployment is current. Run the smoke against the exact deployed build before making a live-availability claim.

Provisional. Always another perspective.

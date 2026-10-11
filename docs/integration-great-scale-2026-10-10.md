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

Readiness includes `scale: beliefToScale(meanBelief)`.

`scale_step` upserts multi-belief peer `great-scale`.

## Live geometry UI

https://great-scale.vercel.app

## Verify

```bash
node platform/test/great-scale.test.mjs
node platform/scripts/dual-plane-smoke.mjs  # scale_state 200
```

Provisional. Always another perspective.

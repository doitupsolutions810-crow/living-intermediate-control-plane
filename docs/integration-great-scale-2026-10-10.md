# Integration — Great Scale ↔ Living Intermediate

## Repositories

| Repository | Role |
|---|---|
| [great-scale](https://github.com/doitupsolutions810-crow/great-scale) | Canonical phase-time geometry, heat law, cone floor, and ninefold involution |
| [living-intermediate-control-plane](https://github.com/doitupsolutions810-crow/living-intermediate-control-plane) | Belief Jacobian, federation, readiness, agents, and additive quantum-geometry adapter |

## Shared invariants

```
heat(h) = h(1-h) ≡ tension(B) = B(1-B)
CONE = φ⁻² ≈ 0.381966
f(x) = (9 - (x mod 9)) mod 9
```

| Great Scale | Lattice |
|---|---|
| h (phase height) | belief B |
| S = heat(h) | tension T |
| zero-mode φ | spectral / mean coupling |
| CONE = φ⁻² ≈ 0.381966 | Ψ ≥ CONE |
| residual 4+3+1 | partition of residual modes |
| optional QGT residual channel | derived geometric heat S_Q; separate from phase-driven S |

The quantum-geometry adapter accepts a positive-definite two-direction metric and Berry-curvature component, validates the QGT bound, and maps the normalized Gram-determinant residual through the existing heat law. It does not overwrite the original phase or belief state. See [QUANTUM_GEOMETRY_BRIDGE.md in great-scale](https://github.com/doitupsolutions810-crow/great-scale/blob/main/QUANTUM_GEOMETRY_BRIDGE.md).

## Platform APIs

| Method | Path | Role |
|---|---|---|
| GET | `/api/v1/scale/state?belief=&view=` | Bridge snapshot |
| POST | `/api/v1/scale/step` | Soft belief step from scale map |
| cockpit | `scale_state` / `scale_step` | Same |

Readiness includes `scale: beliefToScale(meanBelief)`.
`scale_step` upserts multi-belief peer `great-scale`.

## Live geometry UI

https://great-scale.vercel.app

## Verify

```bash
cd platform
npm test
node --check src/bridge/scale-agent.mjs
```

The canonical cone and modular boundary conventions are regression-tested. Provisional scientific interpretation remains separate from mathematical verification.

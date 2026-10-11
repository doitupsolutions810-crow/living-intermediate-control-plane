# Advancement — Great Scale integrated into control plane

## Verified

| Check | Result |
|-------|--------|
| `node test/great-scale.test.mjs` | PASS (`heat ≡ tension`) |
| Live `GET /api/v1/scale/state` | schema `great-scale.bridge/v1` |
| Live `POST /api/v1/scale/step` | 200; peer `great-scale` on graph |
| Cockpit `scale_state` | 200 |
| dual-plane `scale_state` | 200 |
| `bash scripts/smoke-all.sh` | PASS |

## Identity

```
heat(h) = h(1-h)  ≡  tension(B) = B(1-B)
```

## Operator

| Surface | Role |
|---------|------|
| `GET /api/v1/scale/state` | Bridge snapshot |
| `POST /api/v1/scale/step` | Soft belief step + graph peer |
| cockpit `scale_state` / `scale_step` | Same |
| Chat `/scale` | Print B, S, ψ, φ |

Provisional. Always another perspective.

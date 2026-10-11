# Operator dashboard — Great Scale descent

## Open

`http://127.0.0.1:4400/dashboard` or `/ops`

## Math (provisional, from notebooks)

```
S(h) = h(1-h) ≡ tension(B)
f(x) = 9 - (x mod 9)     // involution f(f(x))=x
x* = 4.5                 // mid-coherence fixed point
g(x) = 4.5 + 3.5 cos(2πx/9)
```

Two-cycles: 1↔8, 2↔7, 3↔6, 4↔5.

## Streaming

`GET /api/v1/scale/descent?start=1&steps=48&delayMs=90` — SSE events: `meta`, `step`, `done`.

Each `step` includes xyz, S, ψ, finding text for the agent panel.

## UI

- 3D-ish canvas: ninefold, cone band, descent trajectory, view presets
- Agent findings stream from descent
- Realtime chat → platform `/api/v1/chat/turn` when available

Provisional. Always another perspective.

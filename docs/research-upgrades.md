# Research upgrades (Great Scale)

Provisional research layer on the living intermediate control plane.

## Modules

- `platform/src/bridge/great-scale-research.mjs` — involution, soft map, convergence, cycle stability, stress invariant, hypothesis report
- `platform/src/bridge/descent-engine.mjs` — background descent orbit, persisted to `state/descent-engine.json`
- `platform/src/bridge/scale-agent.mjs` — agent that always carries the main hypothesis; Ollama when reachable
- `platform/scripts/research-suite.mjs` — one-shot research run
- `platform/test/great-scale-research.test.mjs` — unit tests

## Main hypothesis (always restated)

S(h) = h(1-h) ≡ T(B) = B(1-B); f(x) = 9 − (x mod 9), involution; fixed point x* = 4.5; two-cycles (1,8)(2,7)(3,6)(4,5); cone floor; phi zero-mode; stress = moment of now computationally; recursive observation: geometry generates the scale that observes it. No certainty.

## Run

```bash
cd platform
node test/great-scale-research.test.mjs
node scripts/research-suite.mjs 0.5
```

## Env

- `CONTROL12_OLLAMA_URL` (default http://127.0.0.1:11434)
- `CONTROL12_OLLAMA_MODEL` (default tinyllama)
- `CONTROL12_HORIZON_OLLAMA=1` — use Ollama on every horizon step (slow)
- `CONTROL12_DESCENT_BG=1` — start background descent engine with the server

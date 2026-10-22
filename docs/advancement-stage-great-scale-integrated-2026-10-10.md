# Advancement — Great Scale integration

## Current source contract (2026-10-22)

The bridge is mounted in `platform/src/server.mjs`:

| Surface | Current source behavior |
|---------|-------------------------|
| `GET /api/v1/scale/state` | Returns the bridge snapshot and current live lattice state; accepts optional belief, view, time, and rate |
| `POST /api/v1/scale/step` | Validates inputs, computes one phase-time-guided belief step, updates the local lattice frame, and returns the result |
| `GET /health` | Includes a `scale` snapshot derived from the current belief |
| Cone floor | Matches Great Scale: `CONE = (φ − 1)² = φ⁻² ≈ 0.381966` |
| Phase-time | Finite time/rate/product; canonical phase in `[0,1)` |

## Mathematical contract

\[
h=\frac{1-\cos(2\pi\,\operatorname{phase})}{2},\quad
S=h(1-h)=\frac14-(h-\frac12)^2\in[0,\frac14]
\]

\[
\Psi=\mathrm{CONE}+S\ge\mathrm{CONE},\qquad
\mathrm{CONE}=\phi^{-2}\approx0.381966.
\]

The prior bridge used \(\sqrt5-2\approx0.236068=\phi^{-3}\), which did not match Great Scale's \(\phi^{-2}\) constant. The bridge now follows Great Scale's public contract.

## Verification boundary

The source routes and regression tests are committed on a draft integration branch. A source audit is not a live deployment check. The dual-plane smoke now exercises both Scale endpoints, and CI is configured to run the bridge tests on pull requests. Do not treat historical live-endpoint claims as evidence that the current deployment is running this revision until the exact deployed build passes smoke.

Provisional. Always another perspective.

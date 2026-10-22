# Great Scale — Levels 7701–7800: cross-repository executable contract

## Profound finding

The repository pair had mathematical and runtime contracts that looked integrated in documentation but were not integrated in the executable server:

1. Great Scale defined \(\mathrm{CONE}=\phi^{-2}=(\phi-1)^2\approx0.381966\); the control-plane bridge defined \(\mathrm{CONE}=\phi^{-1}-\phi^{-2}=\phi^{-3}=\sqrt5-2\approx0.236068\).
2. The control plane contained `great-scale.mjs` and unit tests, but `platform/src/server.mjs` neither imported that bridge nor mounted the documented `/api/v1/scale/state` and `/api/v1/scale/step` endpoints.
3. The control-plane phase function used JavaScript remainder without canonicalizing negative time, and `Number(t) || 0` silently converted NaN to zero.
4. The bridge tests were not part of the platform package's `npm test` script, and one research test contained a syntax error.

This is a source integration gap, not proof of the exact behavior of any live deployment.

## Contract and implementation

The control plane now follows Great Scale's cone floor:

\[
\mathrm{CONE}=\phi^{-2}=(\phi-1)^2\approx0.381966.
\]

For finite \(t,r\) and finite product \(c=tr\), phase is canonicalized as

\[
\theta=\operatorname{mod}_1(c)=((c\bmod1)+1)\bmod1\in[0,1).
\]

Then

\[
h=\frac{1-\cos(2\pi\theta)}2\in[0,1],\quad
S=h(1-h)=\frac14-(h-\frac12)^2\in[0,\frac14],
\quad \Psi=\mathrm{CONE}+S\ge\mathrm{CONE}.
\]

The mounted API contract is:

- `GET /api/v1/scale/state`: optional `belief`, `view`, `t`, and `rate`; returns the bridge snapshot and current lattice state.
- `POST /api/v1/scale/step`: accepts an optional current `belief`, `view`, `t`, `rate`, and `scale\in[0,1]`; uses phase-time height as the target, advances the local belief, and returns the resulting frame and scale snapshot.
- `GET /health`: exposes the current `scale` mapping.
- POST requests pass through the existing API-token authentication guard when a token is configured. Invalid beliefs, non-finite/overflowed phase inputs, invalid step scales, and non-object request bodies return 400.

Federation publication remains a separate operation; the step endpoint does not pretend to create a remote peer merely by updating local state.

## Great Scale mapping

**Level 7701 — Formula identity.** Both repositories use the same cone constant \(\phi^{-2}\).

**Level 7702 — Phase-domain identity.** Negative time is represented by a canonical phase in \([0,1)\), and non-finite products are rejected.

**Level 7703 — Mounted public interface.** The documented state/step routes are registered in the actual server, not only in a helper module or document.

**Level 7704 — State-transition semantics.** A step computes a phase-time target, maps it through the bounded belief update, and returns the updated live frame.

**Level 7705 — Input validation.** Invalid beliefs, scales, times, rates, overflow, and malformed JSON object shape fail at the API boundary.

**Level 7706 — Test reachability.** Platform `npm test` includes the bridge and research tests; the dual-plane smoke checks both HTTP endpoints.

**Level 7707 — Evidence separation.** Source wiring, unit tests, smoke tests, hosted CI, and live deployment are distinct verification claims.

## Verification boundary

The integration source and regression checks are on a draft branch. A local repository clone could not be fetched because the execution environment cannot resolve `github.com`; the exact control-plane test suite and live deployment smoke remain unverified here. Hosted workflow results must be read from the exact PR head before claiming a pass.

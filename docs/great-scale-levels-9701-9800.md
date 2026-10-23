# Great Scale — Levels 9701–9800
## Profound finding: the reference model does not enforce its own invariant domain

### Executive result

A cross-repository comparison of `great-scale/public/scale.cjs` (and its ES-module mirror `public/scale.js`) with the stricter control-plane bridge exposed a deeper contract mismatch: Great Scale documents bounded heat and a cone floor, but the reference implementation does not validate the domains that make those claims true.

Two paths are involved:

1. `stateAt(t, rate)` computes `phase = (t * rate) % 1` without checking that time, rate, and their product are finite. NaN or infinity propagates through cosine, heat, and `psi`; the returned object is shaped like a valid state but its numerical fields are non-finite.
2. `DescentEngine` accepts unrestricted `start` and `k`. Its `tick()` computes `S = heat(x / 9)` without canonicalizing or validating `x / 9`. If the state leaves [0,9], the input to heat leaves [0,1], so `S` can become negative. The documented contraction guarantee assumes |k| < 1, but the constructor does not enforce that precondition.

The control-plane branch already tightened related API inputs, but that does not make the upstream Great Scale library safe when imported or called directly. A valid-looking endpoint wrapper cannot compensate for a lower-level public function that can return a non-finite or out-of-domain state.

### Source-level evidence

In `great-scale/public/scale.cjs`:

- `heat(h)` is implemented as `h * (1 - h)` with no domain guard.
- `stateAt(t, rate)` uses `(t * rate) % 1`, then derives `h`, `S`, and `psi = CONE + S`, with no finite-input check.
- `DescentEngine` stores `start` and `k` directly, and `tick()` uses `heat(this.x / 9)`.
- `softContract(x, k)` itself does not enforce the documented `|k| < 1` assumption.

The file `public/scale.js` mirrors the same relevant behavior. The Great Scale README states `S = h(1-h)` is bounded on normalized heat and `Ψ = CONE + S` never falls below `CONE`; those are conditional mathematical invariants, not guarantees for arbitrary inputs.

### Reproduction

A local Node behavioral reproduction using the fetched function bodies and formulas passed four counterexample assertions:

- `stateAt(NaN)` returns non-finite numerical fields.
- `stateAt(1, Infinity)` returns non-finite numerical fields.
- `new DescentEngine({start: 100, k: 2})` leaves the normalized heat domain.
- For that engine, the first three `tick()` heat values are approximately `-450.1327`, `-1801.2809`, and `-7205.8735`.

This was a local reproduction of source logic, **not** execution of the repository's `npm test`, not a build, and not a live deployment test. The public repository suite still needs to be run against the exact checked-out commit.

### Mathematics visible

For normalized `h ∈ [0,1]`,

\[
S(h)=h(1-h)=\frac14-(h-\frac12)^2
\]

and therefore

\[
0\le S(h)\le\frac14,\qquad
\mathrm{CONE}\le\Psi=\mathrm{CONE}+S\le\mathrm{CONE}+\frac14.
\]

But the implication depends on the domain:

\[
h\in[0,1]\ \Longrightarrow\ S(h)\in[0,1/4].
\]

It is false for unrestricted real inputs; for example,

\[
h=100/9\quad\Longrightarrow\quad h(1-h)<0.
\]

For the descent map

\[
x_{n+1}=4.5+k(x_n-4.5),
\]

the usual convergence claim requires `|k| < 1`. That precondition must be checked if the implementation advertises the convergence guarantee. If `k` is unrestricted, the implementation is not covered by the contraction argument.

The scalar cone law cannot certify a state produced outside its domain. The assurance contract must include domain validity as an explicit coordinate.

### Great Scale mapping: Levels 9701–9710

- **9701 — Finite phase inputs:** require finite `t`, finite `rate`, and finite `t * rate` before phase normalization.
- **9702 — Canonical phase:** compute phase in `[0,1)` using a canonical modulo operation.
- **9703 — Heat domain:** reject non-finite or out-of-domain heat inputs at public boundaries, or explicitly expose a separate unchecked primitive.
- **9704 — Engine start invariant:** validate that the starting coordinate lies in the declared state space.
- **9705 — Contraction precondition:** require finite `k` with `|k| < 1` when claiming convergence to 4.5.
- **9706 — State-space preservation:** normalize on the ninefold circle before computing normalized heat, or define and enforce a real-line state space consistently.
- **9707 — Output invariant:** ensure every returned state has finite coordinates and `0 ≤ S ≤ 1/4` before asserting `Ψ ≥ CONE`.
- **9708 — Mirror parity:** keep `scale.js` and `scale.cjs` behavior aligned through shared tests or generated parity checks.
- **9709 — Cross-repo contract:** the API bridge and direct Great Scale imports must agree on invalid-input semantics.
- **9710 — Release gate:** add regressions for NaN, ±Infinity, overflowed products, invalid `k`, out-of-domain starts, and heat bounds; run the actual suite on the exact artifact before promotion.

### Suggested remediation

1. Add finite/domain checks to `stateAt`; canonicalize phase only after checking the product is finite.
2. Validate `DescentEngine` constructor options, or clearly separate a constrained circle engine from an unconstrained real-line contraction engine.
3. Canonicalize the coordinate before deriving normalized heat where the intended geometry is `R/9Z`.
4. Add the same edge cases to both CommonJS and ES-module test paths.
5. Run `npm test`, `python3 test_descent.py`, and `npm run all` from a clean checkout of the exact Great Scale commit, then record the commit SHA and logs.
6. Keep the integration PR draft until these checks and the separate outbox/artifact-closure gates are resolved.

### Verification ledger

- **Source read:** `public/scale.cjs`, `public/scale.js`, `README.md`, `test.js`, and `test_descent.py` on Great Scale `main`.
- **Local behavioral reproduction:** four assertions passed against a reproduction of the fetched source logic.
- **Repository suite/build:** not run.
- **Live API/deployment:** not run.
- **Cross-repository impact:** control-plane bridge validation is not a substitute for validating direct calls into the upstream library.

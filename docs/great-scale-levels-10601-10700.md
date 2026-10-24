# Great Scale — Levels 10601–10700

## Profound finding: the same exported name meant different mathematical operations across repositories

### Cross-repository source evidence

I compared the canonical Great Scale implementation, great-scale/public/scale.cjs, with the control-plane research bridge, platform/src/bridge/great-scale-research.mjs, and both repositories' tests.

In the canonical Great Scale source, the operations are distinct:

    function softContract(x, k = 0.5) { return FIXED + k * (x - FIXED); }
    function softMap(x) { return 9 - x; }

So softMap is a reflection/involution on the circle's coordinate representatives, while softContract is a contraction toward FIXED = 4.5.

The control-plane research module instead defined softMap(x, k = 0.5) as:

    FIXED + (x - FIXED) * Math.cos(Math.PI * k)

At the default k = 0.5, cos(πk) = cos(π/2) = 0, so softMap(x, 0.5) = 4.5 for every x. The research function named softMap was neither the canonical circle reflection nor the canonical linear contraction. It was a constant map at the default parameter. The convergence test passed because every tested start reached 4.5 in one iteration, not because it demonstrated a nontrivial iterative descent.

There was a second acceptance gap: cycleStability compared the contraction's output against the involution's expected swapped pairs, but the test suite only tested that involution swaps those pairs. It never exercised cycleStability. Therefore, the existing tests did not establish that the map under study preserved the listed two-cycles.

### Mathematics

Let the circle be S¹₉ = ℝ / 9ℤ, with fixed point c = 4.5.

The canonical reflection is

    R(x) = (9 - (x mod 9)) mod 9.

It satisfies R(R(x)) = x on the circle. In particular, R(1)=8, R(2)=7, R(3)=6, and R(4)=5. Each listed pair is exchanged exactly.

The canonical contraction is

    C_k(x) = c + k(x-c).

For k = 0.5, the distance to the fixed point halves on every iteration:

    |C_k(x)-c| = |k| |x-c| = 0.5|x-c|.

For example, C₀.₅(1)=2.75, then C₀.₅(2.75)=3.625. It converges iteratively rather than collapsing immediately. Reflection and contraction are different operators with different invariants; naming them interchangeably invalidates downstream interpretations.

### Integrated correction

Updated platform/src/bridge/great-scale-research.mjs:

- softMap(x) now delegates to the modulo-nine involution, matching Great Scale's reflection semantics.
- Added softContract(x, k=0.5) for linear contraction toward 4.5, matching the canonical implementation.
- convergenceSteps now iterates softContract.
- cycleStability now tests softMap and the listed circle pairs.
- stressInvariant labels its separate contraction output as a contraction, not the circle map.

Updated platform/test/great-scale-research.test.mjs with regression tests that separately verify circle reflection, involution, contraction behavior, iterative convergence, and cycle preservation.

### Verification record

- Source comparison: confirmed by fetching both repositories' source.
- Fix and regression tests: committed to research/great-scale-api-contract and fetched back from GitHub.
- Local isolated Node.js mathematical harness: PASS. It verified the reflection pairs, double reflection, contraction values, and convergence from starts 1 and 8 in 22 iterations at tolerance 1e-6.
- Full repository npm test: not run.
- Build and HTTP smoke test: not run.
- The local harness checks the formulas and expected behavior; it is not a substitute for executing the committed test files within the repository checkout.

### Great Scale mapping — Levels 10601–10610

- 10601 — A shared name must denote a shared operation across repositories.
- 10602 — Distinguish involutions from contractions.
- 10603 — State the invariant each transformation preserves.
- 10604 — Never infer cycle preservation from convergence toward a fixed point.
- 10605 — Test the exact function whose behavior a test title claims to establish.
- 10606 — Exercise aggregate diagnostics such as cycleStability directly.
- 10607 — Detect degenerate parameters that collapse a whole state space in one step.
- 10608 — Separate compatibility naming from mathematical semantics.
- 10609 — Use cross-repository regression cases for shared contracts.
- 10610 — Treat test coverage gaps as uncertainty, not as evidence of correctness.

### Decision

This is a cross-repository semantic contract defect, not merely a naming preference: the prior research implementation made its default softMap constant, while the canonical Great Scale softMap is an involution. The correction restores the distinction between circle symmetry and scalar contraction and adds tests for both.

Promotion remains on hold until the actual platform test suite, build, and HTTP smoke test run in a repository checkout and the CI status is resolved.

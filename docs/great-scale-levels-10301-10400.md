# Great Scale — Levels 10301–10400
## Profound finding: computed diagnostics are not automatically release-gate conditions

### Scope

Reviewed the current `great-scale` main-branch sources:
- `research/topological-qgt.cjs`
- `test_topological_qgt.cjs`
- `DESCENT_LXXVIII_TOPOLOGICAL_QGT.md`
- `research/DESCENT_XC_CURVATURE_ORIENTATION_ENTROPY.md`
- `package.json` and `.github/workflows/ci.yml`

The bridge computes several residuals for the two-band Qi–Wu–Zhang (QWZ) model. Its final `topologicalMappingValid` condition explicitly requires quadrature convergence, Chern integrality, signed-curvature/Chern agreement, cancellation-identity agreement, entropy agreement, and a nonnegative metric-area excess within tolerance. It does not explicitly include the already-computed `curvatureMixingResidual` or `curvatureOrientationVarianceResidual`.

### Finding

This is an **acceptance-contract completeness gap**, not proof that current outputs are wrong. Some omitted residuals are algebraically dependent on other checks, so blindly adding every residual to the gate could duplicate constraints. But the source does not document a dependency argument that distinguishes redundant checks from independent invariants. The code computes diagnostics that readers may reasonably assume are enforced, while the acceptance predicate does not name them.

The acceptance rule is:

```js
const topologicalMappingValid = quadratureConverged &&
  chernIntegerResidual <= 1e-6 &&
  curvatureChernResidual <= quadratureTolerance &&
  curvatureCancellationIdentityResidual <= 2 * quadratureTolerance &&
  Number.isFinite(curvatureOrientationEntropyResidual) &&
  curvatureOrientationEntropyResidual <= 2 * quadratureTolerance &&
  metricAreaExcess >= -quadratureTolerance;
```

Nearby, the implementation also computes:
- `curvatureMixingResidual = |S_T - PN/A^2|`
- `curvatureOrientationVarianceResidual = |V - V_budgets|`

These are asserted in tests for selected model parameters, but are not direct terms in the production validity predicate.

### Mathematical dependency analysis

Let (P,N\ge0) be positive and negative curvature budgets and (A=P+N). For a pure two-band model, under consistent normalization,

[
C=P-N,qquad A\ge |C|.
]

Then the topological heat correction is

[
S_T=\frac14\left(1-\frac{C^2}{A^2}\right)
=\frac{A^2-C^2}{4A^2}
=\frac{(A-C)(A+C)}{4A^2}.
]

Since (A-C=2N) and (A+C=2P),

[
oxed{S_T=\frac{PN}{A^2}}.
]

The variance identity is

[
oxed{V=1-(C/A)^2=4S_T=\frac{4PN}{A^2}}.
]

Therefore, the mixing and variance checks are mathematically related to the same (P,N,A,C) quantities. They are valuable implementation cross-checks, but they are not independent physical measurements. Their role should be documented as algebraic consistency checks, with normalization and sampled-vs-topological quantities made explicit.

### The deeper assurance principle

A validity flag should state exactly which evidence it enforces, while tests should distinguish:
1. mathematical identities proved from definitions;
2. implementation cross-checks computed through separate code paths;
3. numerical convergence heuristics;
4. external or empirical evidence.

Passing multiple algebraically equivalent checks is not equivalent to obtaining multiple independent confirmations. Conversely, omitting a diagnostic from the gate is not automatically a bug if it is provably redundant and clearly documented.

### Great Scale mapping — Levels 10301–10310

- **10301 — Predicate transparency:** document every condition that makes a topological result acceptable.
- **10302 — Dependency graph:** label each residual as independent, algebraically implied, or heuristic.
- **10303 — Normalization contract:** state the common factors used by (P,N,A,C).
- **10304 — Independent implementation paths:** where practical, compare a link-variable Chern calculation with local-curvature quadrature.
- **10305 — Algebraic audit:** verify (S_T=PN/A^2) and (V=4S_T) without presenting them as independent physical evidence.
- **10306 — Numerical audit:** keep grid refinement and grid-origin discrepancy separate from exact algebraic identities.
- **10307 — Failure injection:** perturb a diagnostic or provide an under-resolved case and confirm the acceptance flag fails when an enforced condition is violated.
- **10308 — Evidence naming:** distinguish `computed`, `checked`, `accepted`, and `empirically validated`.
- **10309 — Model scope:** state that conclusions apply to the specified gapped QWZ two-band model and discretization.
- **10310 — Promotion gate:** require tests to exercise both acceptance and rejection paths.

### Verification ledger

- **Source review:** completed for the listed main-branch files.
- **Algebra:** verified from (A=P+N), (C=P-N), and the implemented normalization.
- **Acceptance-predicate comparison:** verified by source inspection.
- **Existing tests:** inspected; they assert mixing and variance residuals for selected cases.
- **Repository execution:** attempted, but `git clone` failed because this environment could not resolve `github.com`. No test result is claimed.
- **Build/deployment:** not run or verified.
- **Runtime code:** unchanged; this is research documentation.

### Decision

Document the predicate's evidence contract before altering the gate. Then add targeted tests that independently demonstrate (a) a stable gapped case is accepted, (b) a near-transition under-resolved case is rejected, and (c) each genuinely independent required condition can veto acceptance. Do not inflate confidence by counting algebraically redundant residuals as independent proofs.

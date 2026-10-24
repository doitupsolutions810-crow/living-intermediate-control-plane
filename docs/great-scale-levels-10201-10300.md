# Great Scale — Levels 10201–10300
## Deeper result: circle periodicity, contraction, and topological degree cannot be chosen independently

### Finding

The previous descent established that the current affine contraction
`C_k(x)=4.5+k(x-4.5)` is not representative-invariant on \(\mathbb R/9\mathbb Z\) for nonzero default \(k=0.5\). The deeper question is whether a replacement can preserve the circle's ordinary degree-one coordinate structure and also be a strict contraction.

For a continuous circle map with a lift \(F:\mathbb R\to\mathbb R\), degree one means
\[
F(x+9)=F(x)+9.
\]
If \(F\) is differentiable, then
\[
\int_0^9 F'(x)\,dx=F(9)-F(0)=9.
\]
Therefore the average derivative over one period is exactly one:
\[
\frac1{9}\int_0^9F'(x)\,dx=1.
\]
It follows that \(|F'(x)|\le q<1\) cannot hold everywhere. Such a bound would imply
\[
\left|F(9)-F(0)\right|
\le\int_0^9|F'(x)|dx
\le9q<9,
\]
contradicting degree one.

Thus a differentiable degree-one circle map cannot be a strict global contraction in the lifted coordinate with a uniform Lipschitz constant below one.

### Interpretation

This does not mean that no contraction-like map can be defined on a circle. A constant map is well-defined and contracts distances, but has degree zero and discards the circle's winding structure. More generally, a circle map may be periodic and well-defined while having degree zero. The design choice is therefore substantive:

- Preserve degree-one winding / orientation structure, or
- Permit a globally contracting map that can collapse that structure.

Do not require both without clarifying what “contraction” and “preserved structure” mean in the model. The original affine formula is neither a well-defined quotient map nor a justified circle-native contraction.

### Great Scale mapping — Levels 10201–10210

- **10201 — Quotient correctness:** equivalent representatives must map to equivalent outputs.
- **10202 — Degree declaration:** specify the intended topological degree of the circle transformation.
- **10203 — Contraction metric:** define the metric and whether the contraction bound is global.
- **10204 — Periodic-lift constraint:** for degree one, require \(F(x+9)=F(x)+9\).
- **10205 — No-go test:** reject a claimed degree-one differentiable global contraction with Lipschitz constant \(q<1\).
- **10206 — Collapse awareness:** if a degree-zero map is chosen, document the loss of winding/orientation information.
- **10207 — Fixed-point semantics:** test fixed classes on the quotient, not just a selected lift.
- **10208 — Boundary tests:** include \(x\), \(x+9\), and shifts by multiple periods.
- **10209 — Model separation:** do not interpret this topology theorem as empirical evidence about a physical system.
- **10210 — Release gate:** require quotient invariance, stated degree, and metric-specific properties to agree.

### Reproducible verification

The contradiction is analytic and requires no external service or floating-point experiment. A supplementary numeric test can sample the derivative of a proposed periodic lift, but it cannot replace the integral identity. For the current affine function, the earlier representative test already gives:
\[
C_{0.5}(0)=2.25,\qquad C_{0.5}(9)=6.75,
\]
with circular distance \(4.5\), so the current function fails quotient invariance before any degree-based assessment.

### Verification ledger

- **Source reviewed:** Great Scale `README.md`, `test_descent.py`, and the existing QGT/topological research notes.
- **Theorem:** derived from the degree-one lift condition and the integral of its derivative.
- **Numeric experiment:** not needed for the theorem; prior counterexample remains decisive for the current implementation.
- **Repository test suite:** not executed in this pass.
- **Runtime, build, deployment:** not verified.
- **Runtime code:** unchanged; this is a research/documentation integration.

### Decision

Keep PR #16 in draft. The next implementation step is to specify whether the Great Scale circle operator must preserve winding (degree one) or may collapse it (degree zero), and then choose tests consistent with that mathematical contract. Do not treat scalar convergence, periodicity, quotient invariance, and topological degree as interchangeable properties.

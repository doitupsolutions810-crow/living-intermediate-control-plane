# Great Scale — Levels 10001–10100
## Profound finding: the soft-contraction formula does not descend to the documented quotient circle

### Cross-artifact trace

The public Great Scale README and lattice bridge describe the state as circular/modulo-nine, define the involution using modulo 9, and identify 0 and 9 as the same boundary class. The Python oracle in `great-scale/main/test_descent.py` defines the soft contraction as

```python
FIXED = 4.5
def soft_contract(x, k=0.5):
    return FIXED + k * (x - FIXED)
```

Its existing tests check convergence of several selected coordinate representatives toward 4.5. They do not check whether the contraction gives the same output for equivalent inputs (x\sim x+9n).

### Counterexample

On the quotient circle (S^1_9=\mathbb R/9\mathbb Z), coordinates (x) and (x+9n) represent the same state. Let

[
C_k(x)=4.5+k(x-4.5).
]

Then
[
C_k(x+9n)-C_k(x)=9kn.
]

For (C_k) to define a function on the quotient, this difference must be an integer multiple of 9 for every integer (n). That requires (kn\in\mathbb Z) for every (n\), hence (k\in\mathbb Z). Under the documented strict-contraction condition (|k|<1), the only such integer is (k=0).

Concrete seam counterexample with the default (k=0.5):

- (0\sim9) on the quotient circle.
- (C_{0.5}(0)=2.25).
- (C_{0.5}(9)=6.75).
- Their quotient distance is (d_9(2.25,6.75)=4.5), so these outputs are not the same point.

Therefore the raw affine formula contracts representatives in the interval but is not a well-defined continuous contraction of the documented quotient circle. This is a model/interface mismatch, not evidence that either representation is universally wrong: the implementation must choose which state space it means.

### Why this matters

The current selected-start tests can all pass while the quotient-space contract fails. Convergence from a finite list of representatives does not prove representative invariance. This is the deeper issue behind the prior stress-residual seam finding: both the diagnostic and the dynamics currently mix canonicalized modulo-nine state with raw real-line coordinates.

### Great Scale mapping: Levels 10001–10010

- **10001 — State-space declaration:** state whether the dynamics live on the interval ([0,9]), the real line, or the quotient circle (\mathbb R/9\mathbb Z).
- **10002 — Descent-map condition:** for every claimed quotient map (F), require (F(x+9n)\sim F(x)) for all integers (n).
- **10003 — Contraction counterexample:** include the (x=0,9), (k=0.5) seam test.
- **10004 — Dynamics/diagnostic consistency:** use the same state-space semantics for `soft_contract`, `involution`, `mod_dist`, and stress diagnostics.
- **10005 — Interval interpretation:** if the intended state is an interval with a distinguished midpoint and endpoints, stop describing endpoints as equivalent circular representatives for the contraction.
- **10006 — Circle-compatible alternative:** if the state is truly circular, define a circle-native update and specify how it treats the antipodal point; do not silently apply a real-line affine formula to canonical coordinates.
- **10007 — Continuity test:** test values approaching both sides of the seam, not only exact representatives.
- **10008 — Property test:** compare (F(x)) and (F(x+9n)) using (d_9) over positive and negative (n), randomized (x), and allowed parameters.
- **10009 — Proof/test separation:** selected-start convergence tests support only those samples; they do not establish a globally well-defined quotient map.
- **10010 — Promotion gate:** do not claim the circle contraction is fixed until the state-space decision, implementation, and regression tests agree.

### Mathematics and science

The quotient projection is (\pi:\mathbb R\to\mathbb R/9\mathbb Z), where (\pi(x)=\pi(y)) exactly when (x-y\in9\mathbb Z). A map (C) on coordinates induces a quotient map only if

[
\pi(x)=\pi(y)\implies\pi(C(x))=\pi(C(y)).
]

For the affine contraction above, the necessary condition is (9k\in9\mathbb Z), or (k\in\mathbb Z); the documented (|k|<1) leaves only (k=0). A nontrivial circle-native contraction requires a different construction and explicit handling of the circle's topology.

This is a mathematical consistency result for the stated formula and quotient, not a physical law or empirical claim.

### Verification ledger

- **Source read:** fetched the public `great-scale/main/test_descent.py` and confirmed the `soft_contract`, `mod_dist`, and selected-start convergence checks.
- **Analytic derivation:** (C_k(x+9n)-C_k(x)=9kn); quotient compatibility fails for (k=0.5).
- **Numerical counterexample:** (C_{0.5}(0)=2.25), (C_{0.5}(9)=6.75), quotient distance (4.5).
- **Repository test/build:** not run in this pass.
- **Runtime source:** unchanged; this commit records the contract finding only.
- **Integration status:** research branch documentation only; keep PR #16 draft until a state-space decision and exact-head regression tests are made.

### Required next experiment

1. Decide whether 0 and 9 are truly equivalent for the *dynamics*, not just for the involution.
2. If interval semantics are intended, update documentation and remove quotient-circle claims from the contraction contract.
3. If quotient semantics are intended, design a circle-native update, define antipodal behavior, and test seam continuity and representative invariance.
4. Run `python3 test_descent.py`, `npm test`, and `npm run all` on the chosen implementation and exact commit.


## Further descent: the stress diagnostic itself is not a quotient invariant

The same state-space mismatch affects `stress_residual(x)` in `great-scale/test_descent.py`:

```python
def stress_residual(x):
    return abs(x - involution(x))
```

The involution canonicalizes its input modulo nine, but the residual subtracts that canonical representative from the original, uncanonicalized coordinate. Therefore the residual is not invariant under the equivalence relation (x\sim x+9n).

### Minimal counterexample

The quotient classes of 0 and 9 are equal:

[
\pi(0)=\pi(9).
]

But the current implementation yields:

[
r(0)=|0-f(0)|=0,\qquad
r(9)=|9-f(9)|=9.
]

Thus the same quotient state receives two different stress values. Moreover, 9 exceeds the maximum geodesic distance on a circle of circumference 9, which is (9/2=4.5). The raw residual is therefore not a metric distance on the claimed circle.

A quotient-consistent diagnostic would instead be:

[
r_{\mathrm{quot}}(x)=d_9(x,f(x)),
\qquad
d_9(a,b)=\min(|(a-b)\bmod9|,9-| (a-b)\bmod9|).
]

This is a candidate correction only if the intended semantics really are quotient-circle semantics. If the intended state space is the interval ([0,9]), the correct response is instead to define the interval metric and stop treating 0 and 9 as equivalent for all diagnostics.

### Regression properties

For quotient semantics, add properties that must hold for representative shifts (n\in\mathbb Z):

[
d_9(x,x+9n)=0,
\qquad
r_{\mathrm{quot}}(x+9n)=r_{\mathrm{quot}}(x),
\qquad
0\le r_{\mathrm{quot}}(x)\le4.5.
]

Concrete regression assertions should include `stress_residual(0) == stress_residual(9)` under the corrected quotient metric, and representative-shift tests over positive and negative (n). The existing implementation is expected to fail the first assertion; that failure is analytically established here, but the repository test suite has not been run.

### Updated Great Scale decision

This sharpens the Levels 10001–10100 conclusion: it is not only the contraction map that must descend to the quotient. **Every observable/diagnostic claimed to describe a quotient state must also be well-defined on equivalence classes.** State dynamics and diagnostics must use one coherent state-space contract.

This addendum is source analysis and a proposed regression contract. No runtime code has been changed, and no repository test, build, or CI run is claimed.

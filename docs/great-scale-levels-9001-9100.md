# Great Scale Descent — Levels 9001–9100
## Finding: a residual on a quotient must be representative-invariant

### Scope and confidence

This is a cross-repository source audit of the public `great-scale` README and the current Living Intermediate Control Plane draft PR #16, inspected 2026-10-23. It is a mathematical contract check plus a small independent executable harness; it is not a full repository test run, production deployment, or empirical physics result.

### 1. The finding

The Great Scale README defines the continuous state space as the ninefold circle, with points understood modulo nine, and also lists the stress residual as `|x - f(x)|`. Those two statements are incompatible if the residual is intended to be an observable of the circle class rather than of a chosen coordinate representative.

On the quotient \\(\\mathbb R/9\\mathbb Z\\), \\(x\\sim x+9m\\). In particular, \\(0\\sim9\\). A function on the quotient must obey
\\[
R(x+9m)=R(x),\\qquad m\\in\\mathbb Z.
\\]
The raw coordinate difference \\(|x-f(x)|\\) does not in general have that property. It can report a nonzero discrepancy for equivalent representatives at the seam. This is a coordinate artifact, not geometric stress.

### 2. Quotient-safe definition

Let
\\[
r(a,b)=((a-b)\\bmod9+9)\\bmod9,
\\qquad
d_9(a,b)=\\min(r(a,b),9-r(a,b)).
\\]
Then define the involution residual as
\\[
R_9(x)=d_9(x,f(x)), \\
qquad f(x)=(9-(x\\bmod9))\\bmod9.
\\]
By construction, \\(0\\le R_9(x)\\le4.5\\), and equivalent representatives yield the same residual when the modulo operation is canonicalized consistently. This uses the circle's geodesic distance rather than the distance between arbitrary coordinate lifts.

### 3. Independent checks

A small standalone JavaScript reference harness checked:
- seam equivalence \\(R_9(0)=R_9(9)=0\\);
- periodicity over sampled coordinates and integer shifts;
- range bound \\(0\\le R_9\\le4.5\\);
- negative-coordinate canonicalization;
- involution fixed classes at \\(0\\) and \\(4.5\\).

The harness is independent of the repository test runner. It does **not** establish that the committed implementation or CI passed. (The check result is recorded in the accompanying PR comment.)

### 4. Great Scale mapping

The core contraction remains
\\[
x_{n+1}=x^*+k(x_n-x^*),\\qquad |k|<1.
\\]
But contraction in a chosen coordinate lift and geometry on \\(\\mathbb R/9\\mathbb Z\\) are distinct contracts. Any residual used to claim convergence on the circle must be quotient-invariant. Otherwise a harmless coordinate change by nine can change the reported error while leaving the represented state unchanged.

The project floor and heat remain
\\[
\\mathrm{CONE}=\\varphi^{-2}\\approx0.381966,
\\qquad
\\Psi=\\mathrm{CONE}+h(1-h),\\quad h\\in[0,1].
\\]
These are model definitions; neither a valid residual nor a feasible \\(\\Psi\\) establishes an empirical physical law.

### 5. Verification ledger

- **Source inspected:** public `great-scale/README.md`; Living Intermediate Control Plane PR #16 metadata and prior level document.
- **Independent math harness:** targeted quotient-distance properties only.
- **Repository tests/build:** not run in this pass.
- **Hosted CI:** PR #16 remains draft and unmerged; the recorded Actions run failed before any job steps executed (runner ID 0, zero steps). That is an infrastructure/run-start failure, not a test assertion result.
- **Deployment / physical measurement:** not performed.

### 6. Required regression tests

1. Assert \\(R_9(x+9m)=R_9(x)\\) for a range of \\(x\\) and integer \\(m\\), including negative values.
2. Assert \\(R_9(0)=R_9(9)=0\\).
3. Assert \\(0\\le R_9(x)\\le4.5\\) over randomized finite coordinates.
4. Assert the implementation canonicalizes modulo for negative inputs in the same way in JavaScript and Python.
5. Keep any raw Euclidean residual explicitly named as a coordinate-space diagnostic, never as a quotient invariant.

**Disposition:** keep the source-level finding and tests proposed until the actual Great Scale implementation and exact-head test suite are run.
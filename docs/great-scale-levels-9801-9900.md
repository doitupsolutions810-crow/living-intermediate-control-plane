# Great Scale — Levels 9801–9900
## Profound finding: a coordinate residual is not a geometric observable on the quotient

### Executive result

The Great Scale model defines the state coordinate on the ninefold circle \(\mathbb R/9\mathbb Z\), where \(x\) and \(x+9n\) represent the same state. Its involution is
\[
f(x)=(9-(x\bmod 9))\bmod 9.
\]
But **stressResidual(x) = |x - f(x)|** measures ordinary distance between chosen numeric representatives. It is not invariant under the equivalence relation that defines the state space.

The smallest counterexample is the seam:
\[
[0]=[9],\qquad f(0)=f(9)=0,
\]
yet the raw residual reports \(R(0)=0\) and \(R(9)=9\). The same geometric state receives two different “stress” values. This is not a numerical precision issue; it is a mismatch between the declared geometry and the observable.

### Source-level evidence

The fetched **great-scale/public/scale.cjs** defines:
- **involution(x)** by canonicalizing modulo 9;
- **modDist(a,b)** as the shortest circular distance;
- **stressResidual(x)** as **Math.abs(x - involution(x))**.

The file already has the correct quotient-distance primitive, **modDist**, but **stressResidual** does not use it. **DescentEngine.tick()** and **snapshot()** expose that raw residual, so the coordinate-dependence propagates into visible telemetry. The README likewise describes the raw expression while defining a continuous ninefold circle.

This is a static source review plus a local mathematical reproduction. No repository source code was changed by this document, and the full repository suite/build/live deployment were not run.

### Mathematical correction

For the quotient \(\mathbb R/9\mathbb Z\), define
\[
r(a,b)=((a-b)\bmod 9+9)\bmod 9\in[0,9),
\]
\[
d_9([a],[b])=\min(r(a,b),9-r(a,b)).
\]
Then define the quotient-consistent residual as
\[
\boxed{R_9([x])=d_9([x],[f(x)])}.
\]
Because \(d_9([a+9m],[b+9n])=d_9([a],[b])\), this residual depends only on the equivalence classes, not on the representatives. It also obeys
\[
0\le R_9\le 4.5.
\]

Examples:

| Coordinate representative | Raw \(|x-f(x)|\) | Quotient residual \(R_9\) |
|---:|---:|---:|
| 0 | 0 | 0 |
| 9 | 9 | 0 |
| -9 | 9 | 0 |
| 1 | 7 | 2 |
| 10 (same class as 1) | 2 | 2 |
| -8 (same class as 1) | 16 | 2 |
| 4.5 | 0 | 0 |
| 13.5 (same class as 4.5) | 9 | 0 |

The current residual is therefore unsuitable as a quotient-state invariant. It may still be retained as a **representative-dependent coordinate diagnostic**, but it must not be labelled geometric stress without that qualification.

### Great Scale mapping: Levels 9801–9810

- **9801 — State-space declaration:** specify whether the state lives in \(\mathbb R\), \([0,9)\), or the quotient \(\mathbb R/9\mathbb Z\).
- **9802 — Observable compatibility:** every invariant observable must be constant on equivalent representatives.
- **9803 — Quotient residual:** use \(R_9([x])=d_9([x],[f(x)])\) for circle geometry.
- **9804 — Seam consistency:** equivalent seam representatives 0 and 9 must produce identical invariant telemetry.
- **9805 — Periodic representatives:** test \(R_9(x+9n)=R_9(x)\) for positive and negative integers \(n\).
- **9806 — Bounded diagnostic:** require \(0\le R_9\le 4.5\).
- **9807 — Telemetry contract:** **DescentEngine.tick()** and **snapshot()** must identify whether a residual is quotient-invariant or coordinate-dependent.
- **9808 — Mirror parity:** keep **public/scale.js** and **public/scale.cjs** consistent.
- **9809 — Semantic compatibility:** if historical dashboards expect the raw residual, introduce a versioned field or schema change rather than silently changing its meaning.
- **9810 — Release gate:** require seam, periodicity, negative-coordinate, range, and JS/CJS parity tests before treating the residual as a geometric quantity.

### Reproducible check

A local independent Python harness evaluated seam values and periodic shifts:
- \(R(0)=0\), \(R(9)=9\) for the raw expression: counterexample confirmed.
- Quotient residual for 0, 9, and -9: all 0.
- Quotient residual for 1, 10, and -8: all 2.
- Across 1,206 sampled coordinate/shift comparisons, the maximum periodicity discrepancy was approximately \(7.1\times10^{-15}\), consistent with floating-point roundoff.

This checks the mathematical reference formula, not the repository implementation or its tests.

### Verification boundary and remediation

1. Decide whether the exported **stressResidual** is intended as a quotient-geometric invariant or a raw coordinate diagnostic.
2. If geometric, implement it using **modDist(x, involution(x))** in both JS and CJS exports; preserve the old behavior under an explicitly named legacy/coordinate diagnostic if compatibility matters.
3. Add regression tests for 0/9, 1/10/-8, random periodic shifts, bounds, and both module formats.
4. Run **npm test**, **python3 test_descent.py**, and **npm run all** on the exact commit.
5. Verify that UI labels and any stored history do not mix old and new residual semantics.

The deeper principle is that **a valid formula on representatives is not automatically a valid observable on a quotient space**. Great Scale's scalar bounds and descent telemetry only have geometric meaning after the state domain and invariance requirements are made explicit. This is mathematics about the model, not a claim of a new physical law.

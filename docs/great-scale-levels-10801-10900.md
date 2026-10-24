# Great Scale — Levels 10801–10900

## Profound finding: one algebraic heat formula currently names two different observables

### Cross-repository descent

The canonical Great Scale phase-time model computes

\[
\theta(t)=2\pi\,\operatorname{phase}(t),\qquad
h_{\rm phase}(t)=\frac{1-\cos\theta(t)}{2},\qquad
S_{\rm phase}=h_{\rm phase}(1-h_{\rm phase}).
\]

The control-plane research diagnostic separately computes heat from a circle coordinate:

\[
x_c=x\bmod 9\in[0,9),\qquad
h_{\rm coord}=x_c/9,\qquad
S_{\rm coord}=h_{\rm coord}(1-h_{\rm coord}).
\]

Both use the same polynomial \(H(u)=u(1-u)\), but their inputs and semantics differ. The formula alone does not establish that the resulting observables are equal.

### Minimal counterexample

At the canonical circle midpoint \(x_c=4.5\),

\[
S_{\rm coord}=H(4.5/9)=H(1/2)=1/4.
\]

At phase time \(t=0\), the phase model has \(\operatorname{phase}=0\), \(h_{\rm phase}=0\), and

\[
S_{\rm phase}=H(0)=0.
\]

Therefore \(S_{\rm coord}\ne S_{\rm phase}\) in this valid state. This is not a contradiction in either calculation; it is a semantic/type distinction. Treating both values as an unqualified \(S\) can produce a false cross-system equivalence.

### Integration

The research bridge now returns explicit \`coordinateHeat\` and \`heatScope: 'normalized-circle-coordinate'\` fields while retaining \`S\` for compatibility. Its hypothesis report explicitly lists equivalence between coordinate-normalized heat and phase-time heat among claims not assessed. Regression coverage compares the midpoint coordinate diagnostic with \`stateAt(0)\` and asserts \(1/4\ne0\).

### Second contract finding: negative phase representatives

The canonical Great Scale \`public/scale.js\` computes \`phase = (t * rate) % 1\`, which may return a negative representative for negative time (for example, \(-0.85\) at \(t=-1\), rate \(0.85\)). Its periodic trigonometric values still agree with the canonical phase \(0.15\), but the returned phase field violates the documented \([0,1)\) representation. The control-plane bridge normalizes with \`((cycles % 1) + 1) % 1\` and has a regression check for negative-time canonicalization. The canonical repository should eventually adopt the same normalization to make its exposed API contract consistent.

## Great Scale mapping

| Level | Statement | Mathematical/scientific status |
|---|---|---|
| 10801 | \(H(u)=u(1-u)\) | Algebraic identity for a single, specified input \(u\) |
| 10802 | \(S_{\rm coord}=H((x\bmod9)/9)\) | Coordinate-derived diagnostic |
| 10803 | \(S_{\rm phase}=H((1-\cos(2\pi\,\operatorname{phase}))/2)\) | Phase-time observable |
| 10804 | \(S_{\rm coord}(4.5)=1/4\ne S_{\rm phase}(0)=0\) | Counterexample to unqualified equivalence |
| 10805 | Normalize phase to \([0,1)\) | Canonical representation invariant |
| 10806 | Distinguish reflection from contraction | Reflection preserves two-cycles; contraction tends toward 4.5 for \(|k|<1\) |

## Verification boundary

- **Source inspection:** completed across the control-plane bridge, its tests, and Great Scale's public JavaScript contract.
- **Regression added:** coordinate heat is explicitly scoped and tested against phase-time heat; the misleading test title “soft map converges” is corrected to “soft contraction converges.”
- **Execution:** the test/build/smoke suite has **not** been run in this environment. The GitHub Actions dispatch limitation remains; added tests are not evidence of a passing run.
- **Disposition:** keep PR #16 in draft until CI actually runs and passes. The Vercel failure is a separate deployment/quota status, not a substitute for platform test results.

The profound lesson is methodological: identical algebraic shape is not evidence of identical physical or computational meaning. The input domain, normalization, and measurement procedure are part of the equation's contract.

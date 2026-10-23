# Descent LXXXIX — Orientation blindness and identifiability in Great Scale

## Finding

The global topological Great Scale map compresses a signed topological quantity into an even scalar. Let the quantum-geometric area be

\[
\mathcal A_Q=\frac1\pi\int_{\mathrm{BZ}}\sqrt{\det g}\,d^2k,
\qquad C\in\mathbb Z,
\qquad \eta_T=\frac{C}{\mathcal A_Q},
\]

for a converged, gapped pure two-band model in the convention used by the implementation. The metric-curvature inequality gives \(|C|\leq\mathcal A_Q\), so \(\eta_T\in[-1,1]\). Define \(\tau=|\eta_T|\). The Great Scale correction is

\[
S_T=\frac{1-\eta_T^2}{4}=\frac{1-\tau^2}{4},
\qquad
\Psi_T=\frac{3-\sqrt5}{2}+S_T.
\]

The scalar depends on \(\eta_T^2\), not its sign. Therefore \(C\mapsto-C\), with the same area, leaves \(S_T\) and \(\Psi_T\) unchanged. This is an exact symmetry of the mapping, not a claim that opposite Chern phases are physically identical.

## Identifiability theorem

For \(\mathcal A_Q>0\) and a valid map:

- If \(C\ne0\) and \(S_T<1/4\), then \(\tau=\sqrt{1-4S_T}\) and \(\mathcal A_Q=|C|/\sqrt{1-4S_T}\). Thus the pair \((\Psi_T,C)\) recovers the area in exact arithmetic, assuming the pure two-band relation and known integer \(C\).
- If \(C=0\), then \(S_T=1/4\) and \(\Psi_T=(3-\sqrt5)/2+1/4\) for every positive area. The scalar is maximally corrected and cannot recover the absolute geometric area.
- The sign of \(C\) is not inferable from \(\Psi_T\) alone. Retain the signed companion \(\eta_T=C/\mathcal A_Q\), together with \(C\) and \(\mathcal A_Q\), whenever orientation matters.

The implementation now exposes `signedTopologicalPolarization` as the signed Chern number divided by the computed metric-area budget. It is a diagnostic for converged maps; it may fall outside \([-1,1]\) when a raw numerical area estimate violates the theoretical bound, in which case the existing validity gate must reject the scalar.

## Great Scale mapping

\[
\boxed{\eta_T=\frac{C}{\mathcal A_Q}},\quad
\boxed{S_T=\frac{1-\eta_T^2}{4}},\quad
\boxed{\Psi_T=\phi^{-2}+S_T},\qquad
\phi=\frac{1+\sqrt5}{2}.
\]

Use the visible state tuple \((\Psi_T,\eta_T,C,\mathcal A_Q)\). The scalar supplies normalized orientation-agnostic mixing; \(\eta_T\) restores signed orientation, \(C\) preserves quantized topology, and \(\mathcal A_Q\) records absolute geometric scale. These entries have different roles and should not be collapsed into one label.

## Reference-model check

For the Qi–Wu–Zhang model, \(m=-1\) and \(m=+1\) have opposite Chern numbers (\(-1\) and \(+1\)) and symmetry-related metric-area budgets. Consequently their global Great Scale scalar agrees to numerical tolerance while \(\eta_T\) changes sign. At \(m=3\), \(C=0\), \(\eta_T=0\), and \(S_T=1/4\) despite a nonzero, finite area.

## Verification protocol and limitations

The regression case compares \(m=-1,+1,3\), checks \(\eta_T=C/\mathcal A_Q\), verifies scalar equality under the model's orientation-reversing pair, and verifies the zero-Chern maximum correction. Existing grid refinement, grid-origin, signed-curvature/Chern, and cancellation checks remain prerequisites for accepting a numerical mapping.

These are mathematical consequences of the chosen two-band encoding. The convergence logic is a heuristic, not a rigorous quadrature error bound, and this finding is not a new physical law.

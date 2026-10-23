# Descent XC — Curvature-orientation entropy and Great Scale

## Main result

For a converged, gapped, pure two-band model, let the positive and negative Berry-curvature budgets be \(P\) and \(N\), and let

\[
\mathcal A_Q=P+N,\qquad C=P-N,\qquad \eta_T=\frac{C}{\mathcal A_Q}.
\]

The sign variable \(X\in\{-1,+1\}\), sampled with probability proportional to \(|F_{12}|\), has probabilities

\[
p_+=\frac{P}{P+N}=\frac{1+\eta_T}{2},\qquad
p_-=\frac{N}{P+N}=\frac{1-\eta_T}{2}.
\]

The global Great Scale heat term is exactly the product of the two orientation probabilities:

\[
\boxed{S_T=p_+p_- = \frac{1-\eta_T^2}{4}}.
\]

The associated Shannon entropy in nats and bits is

\[
\boxed{H_T=-p_+\ln p_+-p_-\ln p_-},\qquad
\boxed{H_{T,\mathrm{bits}}=\frac{H_T}{\ln2}}.
\]

At the probability endpoints use the continuous convention \(0\ln0=0\). This makes the diagnostic numerically stable at perfect orientation.

## Entropy is a monotone reparameterization, not extra information

Since \(S_T=p_+p_-\), choose

\[
p_{\min}=\frac{1-\sqrt{1-4S_T}}{2}.
\]

Then

\[
H_T=-p_{\min}\ln p_{\min}
-(1-p_{\min})\ln(1-p_{\min}).
\]

For \(0<S_T<1/4\),

\[
\frac{dH_T}{dS_T}
=\frac{\ln\!\left(\frac{1+\sqrt{1-4S_T}}
{1-\sqrt{1-4S_T}}\right)}
{\sqrt{1-4S_T}}>0.
\]

The derivative has limit \(2\) as \(S_T\to1/4\) and diverges as \(S_T\to0^+\), while entropy itself is continuous at both ends. Therefore the entropy is strictly increasing over the Great Scale correction's range and is exactly determined by \(S_T\); it contributes an interpretable information-theoretic scale, not an additional independent degree of freedom.

- \(S_T=0\) gives \(H_T=0\) bits: the sign distribution is deterministic.
- \(S_T=1/4\) gives \(H_T=\ln2\), or one bit: positive and negative curvature budgets are balanced.
- The entropy, like \(S_T\), cannot recover the sign of \(C\) or the absolute geometric area. Keep \((\Psi_T,\eta_T,C,\mathcal A_Q)\).

## Great Scale mapping

\[
\boxed{\Psi_T=\frac{3-\sqrt5}{2}+S_T},\quad
\boxed{H_{T,\mathrm{bits}}=
-p_+\log_2p_+-p_-\log_2p_-}.
\]

This adds an optional entropy interpretation to the existing heat law \(S=h(1-h)\). It does not alter the canonical phase-driven state, and it is not a new physical law.

## Implementation audit

Both topological-QGT implementations expose:

- `curvatureOrientationEntropyNats`
- `curvatureOrientationEntropyBits`
- `curvatureBudgetEntropyNats`, calculated from the sampled positive/negative curvature budgets
- `curvatureOrientationEntropyResidual`, the absolute difference between topology-derived and sampled-budget entropies

The mapping-validity gate now requires this residual to be finite and no greater than twice the current quadrature tolerance, in addition to the existing refinement, grid-origin, signed-curvature/Chern, and cancellation checks. This helps reject near-transition results where the integer Chern channel appears settled but the sampled curvature orientation has not converged. The gate remains a numerical heuristic, not a rigorous integration-error bound.

## Reference QWZ values

For \(m=-1\) and \(m=+1\), the global scalar and entropy agree to numerical precision, while the signed polarization changes sign. On a \(160\times160\) midpoint grid, \(S_T\approx0.073146963\), \(H_T\approx0.277451008\) nats, or \(0.400277193\) bits. For \(m=3\), \(C=0\), so \(S_T=1/4\) and \(H_T=\ln2\) (one bit) despite a nonzero, finite geometric area.

This is a re-description of the two-outcome orientation distribution already encoded by the Great Scale correction, not a claim of a new physical law.

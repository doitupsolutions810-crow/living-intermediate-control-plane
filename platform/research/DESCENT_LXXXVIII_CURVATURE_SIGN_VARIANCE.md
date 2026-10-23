# Descent LXXXVIII — Curvature-sign variance and cancellation

## Result

For a pure two-band model with Berry curvature (F_{12}(k)), define normalized positive and negative curvature budgets

\[
P=\frac{1}{2\pi}\int_{\mathrm{BZ}}\max(F_{12},0)\,d^2k,\qquad
N=\frac{1}{2\pi}\int_{\mathrm{BZ}}\max(-F_{12},0)\,d^2k.
\]

Then the signed Chern number and absolute-curvature budget satisfy

\[
C=P-N,\qquad \mathcal A_Q=P+N
\]

when the metric-curvature bound is saturated pointwise. Consequently,

\[
\boxed{\mathcal A_Q-|C|=2\min(P,N)}
\]

and the global Great Scale correction obeys

\[
\tau=\frac{|C|}{\mathcal A_Q},\qquad
S_T=\frac{1-\tau^2}{4}
=\frac{PN}{(P+N)^2},\qquad
\Psi_T=\frac{3-\sqrt5}{2}+S_T.
\]

## Interpretation

Let a random variable (X\in\{-1,+1\}) encode the sign of the Berry curvature, sampled with probability density proportional to (|F_{12}|). Its positive and negative probabilities are (P/(P+N)) and (N/(P+N)). Therefore

\[
\mathbb E[X]=\frac{P-N}{P+N}=\frac{C}{\mathcal A_Q},\qquad
\operatorname{Var}(X)=1-\left(\frac{C}{\mathcal A_Q}\right)^2=4S_T.
\]

Thus the Great Scale correction is one quarter of the orientation variance of Berry curvature under its own magnitude-weighted measure. It quantifies global curvature-sign mixing; it is not a new physical law and is not a substitute for the signed Chern invariant.

## Numerical audit

The implementation now exposes the minority-sign curvature budget, the signed-curvature-versus-integer-Chern residual, the cancellation-identity residual, and the orientation-variance residual. The scalar is accepted only if grid refinement/origin checks pass and the signed curvature integral and cancellation identity agree with the integer topological invariant within the configured tolerance.

The Richardson-style quotient remains a diagnostic rather than a rigorous bound. The absolute-curvature integrand can be nonsmooth at zero-curvature contours, and a fixed-grid discrepancy is not a mathematical certificate of the true integral error. Near gap closings at (m=-2,0,2), the result must be treated as unresolved unless the independent checks pass.

## Reference model and Great Scale range

For the Qi–Wu–Zhang Hamiltonian
\[
H_m(k)=\sin k_x\,\sigma_x+\sin k_y\,\sigma_y+
(m+\cos k_x+\cos k_y)\,\sigma_z,
\]
the discrete lower-band Chern number is (-1) for (m=-1), (+1) for (m=+1), and (0) for (m=3). In the pure two-band setting (0\le S_T\le1/4), so

\[
\frac{3-\sqrt5}{2}\le\Psi_T\le\frac{3-\sqrt5}{2}+\frac14.
\]

The signed integer (C) and total geometric budget \(\mathcal A_Q\) should always be preserved alongside \(\Psi_T\), because the scalar alone loses orientation and absolute-scale information.

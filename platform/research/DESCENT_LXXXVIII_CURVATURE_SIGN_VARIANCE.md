# Descent LXXXVIII — Curvature-sign variance and cancellation

## Result

For a pure two-band model with Berry curvature $F_{12}(k)$, define the positive and negative curvature budgets

\[
P=\frac{1}{2\pi}\int_{\mathrm{BZ}}\max(F_{12},0)\,d^2k,\qquad
N=\frac{1}{2\pi}\int_{\mathrm{BZ}}\max(-F_{12},0)\,d^2k.
\]

When the metric-curvature bound is saturated pointwise, the signed Chern number and absolute-curvature budget satisfy

\[
C=P-N,\qquad \mathcal A_Q=P+N.
\]

It follows that

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

## Interpretation: a variance, not another invariant

Let $X\in\{-1,+1\}$ encode the sign of Berry curvature, sampled with probability density proportional to $|F_{12}|$. Its positive and negative probabilities are $P/(P+N)$ and $N/(P+N)$. Thus

\[
\mathbb E[X]=\frac{P-N}{P+N}=\frac{C}{\mathcal A_Q},\qquad
\operatorname{Var}(X)=1-\left(\frac{C}{\mathcal A_Q}\right)^2=4S_T.
\]

Therefore the Great Scale correction is one quarter of the orientation variance of Berry curvature under its own magnitude-weighted measure. It quantifies global curvature-sign mixing; it is not a new physical law or a replacement for the signed Chern invariant.

A useful consequence is that $C=0$ forces the maximum $S_T=1/4$ in this two-band mapping, even when the curvature magnitude budget is small. The scalar captures normalized sign balance, not absolute geometric scale; preserve the tuple $(\Psi_T,C,\mathcal A_Q)$ for context.

## Numerical audit

The implementation exposes the minority-sign curvature budget, the signed-curvature-versus-integer-Chern residual, the cancellation-identity residual, and the orientation-variance residual. The scalar is accepted only when grid-refinement and grid-origin checks pass and the sampled signed curvature integral and cancellation identity agree with the integer topological invariant within the configured tolerance.

The Richardson-style quotient remains a diagnostic, not a rigorous error bound. The absolute-curvature integrand can be nonsmooth at zero-curvature contours, and a fixed-grid discrepancy does not certify the true integration error. Near gap closings at $m=-2,0,2$, treat the result as unresolved unless the independent checks pass.

## Reference model and Great Scale range

For the Qi–Wu–Zhang Hamiltonian

\[
H_m(k)=\sin k_x\,\sigma_x+\sin k_y\,\sigma_y+
(m+\cos k_x+\cos k_y)\,\sigma_z,
\]

the discrete lower-band Chern number is $-1$ for $m=-1$, $+1$ for $m=+1$, and $0$ for $m=3$. The pure two-band range is $0\le S_T\le1/4$, so

\[
\frac{3-\sqrt5}{2}\le\Psi_T\le\frac{3-\sqrt5}{2}+\frac14.
\]

The signed integer $C$ and total geometric budget $\mathcal A_Q$ should be preserved alongside $\Psi_T$, because the scalar alone loses orientation and absolute-scale information.

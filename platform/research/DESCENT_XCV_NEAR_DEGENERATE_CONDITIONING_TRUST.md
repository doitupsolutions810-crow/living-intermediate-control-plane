# Descent XCV — Near-degenerate metric conditioning is a trust boundary

## Finding

Metric normalization controls overflow/underflow from common rescaling, but it does not remove cancellation in the normalized determinant:
\[
\det g=g_{11}g_{22}-g_{12}^2.
\]
For \(g_\epsilon=\begin{pmatrix}1&1-\epsilon\\1-\epsilon&1\end{pmatrix}\), the exact eigenvalues are \(\epsilon\) and \(2-\epsilon\), and \(\det g=\epsilon(2-\epsilon)\). In floating-point arithmetic, the determinant subtracts nearly equal products. A positive computed determinant alone is not evidence that its relative error is small.

## Added diagnostics

The Great Scale and Control Plane bridge implementations expose:
- `metricDeterminantRelativeSeparation = detScaled / (|a11*a22| + |a12*a12|)`, a cancellation indicator, not a rigorous error bound;
- `metricConditionNumberEstimate`, an estimate based on the normalized larger eigenvalue and determinant, null when determinant cancellation is below the configured numerical threshold;
- `conditioningStatus`: `well-conditioned`, `ill-conditioned` (estimated condition number at least \(10^8\)), or `numerically-unresolved` (determinant separation at most \(64\epsilon_{machine}\)).

When not flagged unresolved, the smaller eigenvalue uses \(\lambda_{min}=\det(g)/\lambda_{max}\), avoiding a second cancellation in \(\bar\lambda-\Delta\). In the unresolved regime, the legacy direct estimate remains available for compatibility but must not be treated as certified.

These thresholds are operational diagnostics, not universal physical constants. They do not regularize the metric, inject an epsilon into the determinant, or convert unresolved geometry into valid geometry.

## Great Scale map

The existing local scalar remains
\[
\chi=\frac{|F_{12}|}{2\sqrt{\det g}},\quad
S=\frac{1-\min(1,\chi)^2}{4},\quad
\Psi=\frac{3-\sqrt5}{2}+S.
\]
The scalar is invariant under common positive scaling \((g,F_{12})\mapsto(sg,sF_{12})\), but that invariance does not imply numerical reliability near a degenerate metric. Consumers should preserve the result tuple \((\Psi,\chi,\text{conditioningStatus},\text{condition estimate},\text{projection diagnostics})\).

## Regression and verification status

Regression tests cover an exactly analyzable near-degenerate family with \(\epsilon=10^{-8}\) and a floating-point-resolution edge near \(10^{-16}\). This change is proposed on a review branch. It has not been locally executed in this environment; GitHub Actions job payloads currently return empty step lists, and log downloads return BlobNotFound, so CI cannot certify these tests yet.

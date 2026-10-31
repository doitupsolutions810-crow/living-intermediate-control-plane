# Descent XCVI — Compensated metric determinant and numerical trust

## Finding

The QGT bridge is invariant under common positive scaling, but that does not guarantee accuracy near a singular metric. In
\[
g_\varepsilon=\begin{pmatrix}1&1-\varepsilon\\1-\varepsilon&1\end{pmatrix},
\]
the exact determinant is \(\varepsilon(2-\varepsilon)\) and the eigenvalues are \(\varepsilon\) and \(2-\varepsilon\). The expression \(g_{11}g_{22}-g_{12}^{2}\) subtracts nearly equal products, causing relative error to grow as \(\varepsilon\to0\).

## Correction

The ESM bridge now uses compensated product/subtraction arithmetic for the normalized determinant and computes \(\lambda_{\min}=\det(g)/\lambda_{\max}\) rather than subtracting mean and spread. It returns `metricConditionNumber` and `metricConditionStatus` (`well-conditioned`, `ill-conditioned`, or `numerically-unresolved`). These are numerical-trust diagnostics; they do not change QGT acceptance or regularize a metric by adding an arbitrary epsilon.

The thresholds are machine-precision heuristics. A condition number above \(1/\sqrt{\epsilon_{mach}}\) is flagged ill-conditioned; a non-finite condition estimate or relative small eigenvalue at or below \(64\epsilon_{mach}\) is flagged numerically unresolved. Compensated arithmetic improves evaluation of the represented inputs but cannot remove the intrinsic sensitivity of near-singular geometry.

## Great Scale mapping

With \(\chi=|F_{12}|/(2\sqrt{\det g})\),
\[
S_Q=\frac{1-\chi^2}{4}=\frac14\frac{\det Q}{\det g},\qquad
\Psi_Q=\frac{3-\sqrt5}{2}+S_Q.
\]
The scalar map is unchanged. The conditioning fields add a separate trust channel. Under \((g,F)\mapsto(sg,sF)\), both \(\chi\) and \(\kappa_2(g)\) are scale invariant while the scaled inputs remain representable.

## Regression and verification status

Tests were added for near-degenerate reference matrices, determinant/eigenvalue consistency, trust classification, and scale invariance. Tests are not marked passed until actual execution evidence exists. The latest inspected Actions runs are failed, but job-step summaries are empty and log downloads return `BlobNotFound`; the available evidence does not reveal whether the failure is in code, runner provisioning, or another workflow layer.

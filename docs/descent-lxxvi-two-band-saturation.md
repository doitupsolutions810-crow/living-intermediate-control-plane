# Descent LXXVI — Two-band QGT saturation and Great Scale degeneracy

Status: analytically derived and encoded as regression tests; not a new physical law.

## Model

Take a normalized pure qubit state on the Bloch sphere,
\[
|\psi(\theta,\varphi)\rangle =
\cos(\theta/2)|0\rangle+e^{i\varphi}\sin(\theta/2)|1\rangle,
\qquad 0<\theta<\pi.
\]
Its Fubini–Study metric in coordinates \((\theta,\varphi)\) is
\[
g_{\theta\theta}=\frac14,\quad
g_{\varphi\varphi}=\frac{\sin^2\theta}{4},\quad
g_{\theta\varphi}=0,
\]
and with convention \(F_{12}=2\operatorname{Im}Q_{12}\), the Berry curvature has magnitude
\[
|F_{\theta\varphi}|=\frac{\sin\theta}{2}.
\]
Therefore
\[
\det g=\frac{\sin^2\theta}{16},\quad
\frac{F_{\theta\varphi}^2}{4}=\frac{\sin^2\theta}{16},\quad
\det Q=\det g-\frac{F_{\theta\varphi}^2}{4}=0.
\]
So the QGT positivity bound saturates: \(\chi=1\), \(R=0\).

## Great Scale mapping

Using \(h_Q=(1+\chi)/2\), \(S_Q=h_Q(1-h_Q)\), and \(\Psi_Q=\phi^{-2}+S_Q\),
\[
\chi=1\Rightarrow h_Q=1,\quad S_Q=0,\quad
\Psi_Q=\mathrm{CONE}=\phi^{-2}=\frac{3-\sqrt5}{2}\approx0.381966.
\]

## Profound limitation exposed

Every regular two-parameter pure-state family in a two-level Hilbert space maps to this same cone-floor value, independent of local coordinates' metric area after normalization. The scalar channel thus cannot distinguish distinct regular qubit textures or recover the sign of Berry curvature. This is a property of the map and the rank-one complex QGT, not a prediction that all two-band systems have identical physical responses.

The bridge remains useful as a normalized positivity/saturation diagnostic, but not as a sufficient descriptor of two-band quantum geometry. To distinguish such models, retain additional channels: signed curvature, metric components/eigenvalues, metric determinant or a reference scale, and/or global invariants such as integrated Berry curvature/Chern number. Global invariants require a closed parameter manifold and a gapped band.

## Verification

The paired repository regression tests instantiate the analytic Bloch-sphere metric at \(\theta=0.7\), verify \(\det Q=0\), \(\chi=1\), \(S_Q=0\), and \(\Psi_Q=\mathrm{CONE}\). Run the existing test commands in each repository. A local targeted test run is not equivalent to a full hosted CI run.

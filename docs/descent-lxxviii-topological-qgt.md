# Descent LXXVIII — Local QGT saturation versus global topology

Status: additive model study; verified numerical result for a specified two-band Hamiltonian, not a new physical law.

## Hamiltonian and global invariant

Study the Qi–Wu–Zhang model on the Brillouin torus:
\[
H_m(k_x,k_y)=\sin k_x\,\sigma_x+\sin k_y\,\sigma_y+
(m+\cos k_x+\cos k_y)\,\sigma_z.
\]
The occupied band is the lower-energy eigenstate. The gap closes at \(m=-2,0,2\). With the orientation fixed in the implementation, the discrete Chern number is \(C=-1\) at \(m=-1\), \(C=+1\) at \(m=+1\), and \(C=0\) at \(m=3\).

The calculation uses the gauge-invariant Fukui–Hatsugai–Suzuki plaquette phase:
\[
C_N=\frac{1}{2\pi}\sum_k \arg\!\left[
U_x(k)U_y(k+\hat x)U_x(k+\hat y)^*U_y(k)^*
\right],
\quad U_\mu(k)=\frac{\langle u(k)|u(k+\hat\mu)\rangle}{|\langle u(k)|u(k+\hat\mu)\rangle|}.
\]
The orientation fixes the sign; reversing it flips \(C\), not the distinction between the phases.

## Local QGT result

For a pure two-level state with Bloch vector \(n=d/|d|\), at regular points:
\[
g_{ij}=\frac14\,\partial_i n\cdot\partial_j n,\qquad
|F_{12}|=\frac12\left|n\cdot(\partial_1 n\times\partial_2 n)\right|.
\]
The derivatives lie in the tangent plane of the unit sphere, so
\[
\det g=\frac{F_{12}^2}{4},\quad \chi=1,\quad S_Q=0,\quad \Psi_Q=\phi^{-2}.
\]
Therefore the local scalar Great Scale channel cannot distinguish the \(C=-1\), \(C=+1\), and \(C=0\) phases at regular points. The test computes the local metric and curvature analytically from the model, passes them into the existing bridge, and independently computes the global Chern number from the occupied-state lattice links.

## Great Scale integration

Retain \(S_Q=(1-\chi^2)/4\) and \(\Psi_Q=\phi^{-2}+S_Q\) unchanged. Treat \(C\in\mathbb Z\) as a separate global channel calculated over the full periodic parameter domain. A single local sample, even with signed curvature, is not a substitute for a global topological invariant.

## Verification

The new tests check \(C=-1,+1,0\) for \(m=-1,+1,3\), reject the critical masses \(m=-2,0,2\) even on odd-sized grids, verify local QGT saturation, and compare 20×20 and 40×40 grids in gapped phases. This is numerical verification of the specified model, not a claim of experimental validation or universality beyond the model.


## Descent LXXIX — Sign-consistent curvature and a topological metric-area bound

### Finding 1: the occupied-band curvature sign must agree with the global invariant

The lower-band projector of this Hamiltonian has Bloch vector \(s(k)=-d(k)/|d(k)|\), not \(+d/|d|\). Replacing \(n\) by \(-n\) leaves the quantum metric unchanged but reverses the Berry-curvature sign. Therefore the analytic lower-band curvature must be
\[
F_{12}=-\frac12 n\cdot(\partial_{k_x}n\times\partial_{k_y}n),
\quad n=d/|d|.
\]
The old sign did not affect the absolute-curvature Great Scale scalar, but it disagreed with the Fukui–Hatsugai–Suzuki (FHS) Chern-number orientation. The analytic routine is corrected, and a new test compares the full-zone curvature integral with the independently link-computed Chern number for \(m=\pm1\).

### Finding 2: quantum-metric area pays a topological minimum

For a pure two-band state,
\[
\det g=\frac{F_{12}^{2}}4,\qquad
\sqrt{\det g}=\frac{|F_{12}|}{2}.
\]
Define the dimensionless metric-area budget on the Brillouin torus:
\[
\mathcal A_Q=\frac1\pi\int_{\mathrm{BZ}}\sqrt{\det g}\,d^2k
=\frac1{2\pi}\int_{\mathrm{BZ}}|F_{12}|\,d^2k.
\]
Because the Chern number is the signed curvature integral, the triangle inequality gives
\[
\boxed{\mathcal A_Q\ge |C|},\qquad
\mathcal E_Q=\mathcal A_Q-|C|\ge0.
\]
This separates net topological degree from unsigned geometric coverage: positive and negative local curvature can cancel in \(C\), but both contribute to metric area. The excess \(\mathcal E_Q\) measures area beyond the minimum forced by topology.

### Great Scale mapping

Keep the established local scalar unchanged:
\[
\Psi_Q=\phi^{-2}+S_Q,\quad S_Q=\frac14(1-\chi^2).
\]
Expose a separate global channel with \(C\in\mathbb Z\), \(\mathcal A_Q\), and \(\mathcal E_Q\). For a compact Great Scale scalar, define the topological saturation ratio \(\tau=|C|/\mathcal A_Q\in[0,1]\), then
\[
h_T=\frac{1+\tau}{2},\quad
S_T=h_T(1-h_T)=\frac{1-\tau^2}{4},\quad
\Psi_T=\phi^{-2}+S_T.
\]
The implementation emits chernNumber, metricAreaBudget, metricAreaExcess, topologicalSaturation, STopological, and psiTopological. Preserve the signed integer \(C\) separately: the heat scalar intentionally loses its sign. This is an additive diagnostic, not a replacement for the phase-driven Great Scale state or a physical law.

### Verification added

Tests check (1) local curvature integration agrees in sign and value with the FHS Chern result in both \(C=\pm1\) phases, (2) \(\mathcal A_Q=\frac1{2\pi}\int|F|\ge|C|\), (3) the metric-area budget approaches a stable value from 40×40 to 80×80, and (4) the trivial phase has \(C=0\) despite a nonzero unsigned metric-area budget. The lower bound follows analytically from the QGT identity and triangle inequality; the numerical tests verify its implementation for this Hamiltonian.


## Descent LXXX — Numerical certification across the phase diagram

A discrete Chern estimate and a quadrature of the analytic Berry curvature are related but distinct numerical procedures. The FHS lattice-link sum is gauge-invariant and is the primary integer diagnostic; the local-curvature integral is a separate numerical quadrature that should be validated by refinement rather than forced to equal the integer at arbitrary precision on one grid.

For the Qi–Wu–Zhang model, the gapped phases represented by the sweep are:
- (m<-2): (C=0)
- (-2<m<0): (C=-1) with this code's orientation
- (0<m<2): (C=+1)
- (m>2): (C=0)

The exact transition masses (m=-2,0,2) remain rejected. The added sweep samples multiple parameter values in each gapped region, requiring the FHS result to be close to an integer and to match the expected phase. A separate refinement check compares 40×40 and 80×80 curvature quadrature error. This is a numerical reliability improvement for this Hamiltonian, not a universal grid-size guarantee; points close to a transition may require much finer sampling.

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

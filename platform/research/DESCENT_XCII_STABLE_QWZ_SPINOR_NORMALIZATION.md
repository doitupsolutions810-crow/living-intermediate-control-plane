# Descent XCII — Stable eigenstate normalization at extreme finite scale

## Finding

The QWZ lower-band spinor used algebraically valid gauge-patch vectors, followed by normalization. For finite but very large mass |m|, E and |d_z| can both be finite while E + |d_z| overflows IEEE-754 double precision to infinity. The subsequent normalization can then produce NaN components. The model is gapped and its normalized eigenstate is well-defined; this is avoidable numerical overflow.

## Stable formulation

Use dimensionless ratios and the stable spinor component. For d_z >= 0, set b = sqrt((1 + d_z/E)/2) and a = (-d_x/E + i d_y/E)/(2b). For d_z < 0, set a = sqrt((1 - d_z/E)/2) and b = (-d_x/E - i d_y/E)/(2a). These are equivalent normalized gauge-patch states, but avoid constructing E ± d_z or a norm that overflows. The pre-existing gap check ensures E is nonzero.

## Great Scale interpretation

This is a numerical-conditioning correction, not a new physical law and not a change to the Hamiltonian, Berry-curvature convention, Chern invariant, or Great Scale mapping. Regression checks cover finite spinor components, unit norm, and the trivial phase C = 0 for m = Number.MAX_VALUE.

## Verification scope

Regression tests are added in both implementations. The source and test edits are committed through GitHub. Unless a repository test runner is actually executed, the regression tests must be reported as added but not runtime-verified; an independent arithmetic check is not equivalent to executing the committed test suite.

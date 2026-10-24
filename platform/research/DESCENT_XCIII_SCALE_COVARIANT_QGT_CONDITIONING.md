# Descent XCIII — Scale-covariant determinant conditioning in the local QGT bridge

## Finding

The scalar chi = |F12|/(2 sqrt(det g)) is invariant under common positive scaling (g,F) -> (s g,s F), because det(sg)=s^2 det(g). But direct floating-point evaluation of det(g)=g11*g22-g12^2 can underflow or overflow before the ratio is formed. For example, the valid geometry (g11,g12,g22,F)=(1,0,1,1) and its common 1e-200 rescaling have identical chi=1/2, while the raw determinant of the rescaled input underflows to zero and the previous implementation rejects it.

## Correction

Normalize the metric by s=max(g11,|g12|,g22), calculate a dimensionless determinant from g/s, and use F/s in the curvature ratio. Then chi is computed without squaring the original scale. Reconstruct dimensional determinants only for returned diagnostics; those values may legitimately underflow or overflow if the actual determinant lies outside double precision. The Great Scale scalar remains invariant when its dimensionless inputs remain representable.

## Great Scale mapping

S=(1-chi^2)/4 and Psi=(3-sqrt(5))/2+S remain unchanged. This is a numerical-stability improvement, not a new physical law. The scaled determinant must be strictly positive; near-degenerate metrics can still be unresolved at finite precision and must not be silently accepted.

## Regression scope

Both parallel QGT bridges gain tests for common rescalings 1e-200 and 1e200. Source edits and tests are committed through GitHub. Repository workflow results are inspected separately; a failed build/workflow must not be reported as a passing unit test.

# Descent XCIII addendum — Scale-covariant metric eigenvalues

## New finding

The previous normalization made the Great Scale scalar
\[
\chi=\frac{|F_{12}|}{2\sqrt{\det g}}
\]
stable under common scaling, but the diagnostic metric eigenvalues were still computed from raw entries:
\[
\lambda_\pm=\frac{g_{11}+g_{22}}2\pm\sqrt{\left(\frac{g_{11}-g_{22}}2\right)^2+g_{12}^2}.
\]
The sum and squared terms can overflow for entries around \(10^{200}\), although the true eigenvalues themselves remain representable. This produces non-finite diagnostics for a perfectly ordinary metric multiplied by a large unit conversion factor.

## Correction

Let \(s=\max(g_{11},|g_{12}|,g_{22})\) and \(\tilde g=g/s\). Compute
\[
\tilde\lambda_\pm=\frac{\tilde g_{11}+\tilde g_{22}}2
\pm\operatorname{hypot}\!\left(\frac{\tilde g_{11}-\tilde g_{22}}2,\tilde g_{12}\right),
\qquad \lambda_\pm=s\tilde\lambda_\pm.
\]
This keeps the intermediate sum and norm dimensionless and bounded. It preserves the intended eigenvalues whenever the final eigenvalues themselves are representable. Dimensional determinants can still legitimately underflow/overflow when their mathematical values exceed IEEE-754 range; the dimensionless Great Scale scalar is distinct from those dimensional diagnostics.

## Regression tests

Both CommonJS and ESM bridges now check that for the isotropic metric scaled by \(10^{-200}\) and \(10^{200}\), (a) \(\chi=1/2\) and the Great Scale heat are unchanged, and (b) both eigenvalues remain finite and recover the expected scale after division by the common factor.

## Great Scale mapping

\[
S=\frac{1-\chi^2}{4}=\frac{3}{16},\qquad
\Psi=\frac{3-\sqrt5}{2}+\frac{3}{16}.
\]
The scalar mapping is unchanged. This descent strengthens numerical covariance of the diagnostic representation; it does not establish a new physical law. Repository test and build results must be read from the new workflow runs rather than inferred from the equations.

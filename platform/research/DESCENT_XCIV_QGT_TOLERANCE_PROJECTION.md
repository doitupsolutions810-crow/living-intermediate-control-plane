# Descent XCIV — Explicit diagnostics for tolerated QGT positivity projection

## Finding

The bridge admits inputs when
\[
\chi_{\mathrm{raw}}=\frac{|F_{12}|}{2\sqrt{\det g}}\le 1+\tau,
\]
where \(\tau\) is a user-supplied dimensionless tolerance, then clips the reported scalar to \(\chi=\min(1,\chi_{\mathrm{raw}})\). This can be a defensible round-off policy, but without preserving the unclipped value it silently makes slightly invalid input look exactly saturated.

For example, \(g=I\), \(F_{12}=2(1+5\times10^{-11})\) and the default \(\tau=10^{-10}\) yields \(\chi_{\mathrm{raw}}=1+5\times10^{-11}\), but the mapped scalar is exactly the same as at true saturation. The old return object did not disclose the projection.

## Correction

Both CommonJS and ESM bridges now return:

- \(\chi_{\mathrm{raw}}\) as `rawCurvatureFraction`
- \(\max(0,\chi_{\mathrm{raw}}-1)\) as `positivityOvershoot`
- whether any clipping occurred as `saturationProjected`

The acceptance rule and existing scalar outputs are unchanged: violations above tolerance throw; within-tolerance overshoots are clipped for the legacy scalar, but are no longer hidden from consumers. Callers can distinguish exact saturation (raw value <= 1) from tolerance-projected saturation.

## Great Scale map

The projected legacy scalar still yields
\[
S=\frac{1-\chi^2}{4},\qquad
\Psi=\frac{3-\sqrt5}{2}+S.
\]
For the deliberately overshooting test input, \(S=0\) because the policy clips \(\chi\) to 1. The new diagnostic is the important result: it records that the input's raw ratio was above the geometric bound. This does not redefine the QGT or claim that an invalid input is physically valid.

## Regression scope and verification

Regression cases assert that a small overshoot is explicit, that excess beyond the tolerance is rejected, and that the legacy saturation mapping remains backward-compatible. The edited source and tests were fetched back through GitHub after commits. GitHub Actions currently fails before any job steps are reported (empty `steps`, no runner assigned in the job payload); the connector cannot retrieve the job logs, so repository runtime tests remain unverified. Independent arithmetic checks are not a substitute for a passing CI run.

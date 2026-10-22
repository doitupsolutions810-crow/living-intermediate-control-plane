# Great Scale — Levels 7801–7900: numerical validity before invariant claims

## Profound finding

The bridge used two incompatible invalid-input fallbacks, and its research model applied a normalized heat formula to an unnormalized circle coordinate:

- `heat(NaN)` and `heat(Infinity)` returned 0, suggesting zero tension.
- The belief clamp mapped a non-finite value to 0.5, suggesting maximum tension because \(0.5(1-0.5)=1/4\).
- The generic belief integrator could allow a non-finite intermediate result to be clamped into a plausible midpoint.
- The research `hypothesisReport(x)` computed `heat(x / 9)` directly. For negative or non-canonical representatives such as x = -1, this made S negative even though -1 and 8 are the same circle point.
- A research test incorrectly required exact real-line equality `f(f(9)) = 9`, although the circle map correctly returns canonical representative 0. The involution law is equality modulo 9, not equality of chosen representatives.

Thus the same invalid numerical input could be interpreted as both minimum and maximum tension. The resulting state could look valid while losing the distinction between valid model state and invalid computation.

## Contract repair

For the normalized heat domain, require finite \(h\in[0,1]\):

\[
S(h)=h(1-h)=\frac14-(h-\frac12)^2.
\]

It follows directly that \(0\le S(h)\le1/4\). Inputs outside the domain or non-finite values are rejected instead of being silently mapped to a plausible value.

The research model now canonicalizes circle coordinates before deriving normalized heat and tests involution equality modulo 9. The belief integration boundary also rejects non-finite belief, delta, coupling, scale, and computed next-state values. Finite belief values outside \([0,1]\) remain clamped to the normalized belief interval; the heat function itself is strict because its mathematical contract is specifically on \([0,1]\).

## Great Scale mapping

**Level 7801 — Domain precondition.** Heat is evaluated only for finite normalized state \(h\in[0,1]\).

**Level 7802 — No invalid-state laundering.** NaN and infinities are errors, not substitutes for zero or midpoint state.

**Level 7803 — Transition integrity.** Belief integration rejects non-finite transition parameters and non-finite results before state normalization.

**Level 7804 — Invariant derivation.** Given \(h\in[0,1]\), \(S(h)=1/4-(h-1/2)^2\in[0,1/4]\).

**Level 7805 — Regression evidence.** Tests cover endpoints, interior peak, out-of-domain values, NaN, infinities, and non-finite transition parameters.

**Level 7806 — Circle quotient semantics.** Equivalent representatives x and x + 9 produce the same canonical coordinate; the involution is an involution on the quotient circle, not on raw real representatives.

**Level 7807 — Periodic heat.** Compute S from the canonical representative x_c / 9, so S(x + 9) = S(x) and 0 ≤ S ≤ 1/4.

**Level 7808 — Model/evidence separation.** The algebra proves a bound under its domain assumptions; runtime tests must establish that those assumptions are enforced at the code boundary.

## Verification boundary

Tests are added to the platform bridge test file. The execution environment has not yet run the complete repository suite or live HTTP smoke. Targeted harnesses and hosted CI results must be recorded separately; a source edit is not a passing test.

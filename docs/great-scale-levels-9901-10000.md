# Great Scale — Levels 9901–10000
## Profound finding: the invariant is documented, but the executable test oracle still violates it

### Cross-artifact trace

The previous descent (Levels 9801–9900) identified that the Great Scale state lives on the quotient circle \\(\\mathbb R/9\\mathbb Z\\): coordinates differing by an integer multiple of 9 represent the same state. It recommended using the shortest quotient distance for a geometric stress residual, or explicitly labelling the raw residual as coordinate-dependent.

A fresh read of the public `great-scale/main/test_descent.py` shows the canonical test harness still defines:

```python
def stress_residual(x):
    return abs(x - involution(x))
```

The same file canonicalizes the input inside `involution(x)`, but subtracts the canonical image from the *un-normalized* input. That mixes a quotient-space state with a coordinate-space distance. The harness only checks the residual at 4.5 and 2.0; it does not test representative invariance at the seam (0 versus 9) or under shifts by 9.

### Counterexample

The quotient relation is \\(x\\sim x+9n\\). In particular, \\(0\\sim9\\). The implementation gives:

- `stress_residual(0) = 0`
- `stress_residual(9) = 9`

So the diagnostic changes by 9 even though the represented point is unchanged. This is not a floating-point issue; it is a direct consequence of mixing a raw coordinate with a canonical representative.

If the intended quantity is geometric distance on the quotient circle, use:

```python
def stress_residual(x):
    return mod_dist(x, involution(x))
```

where `mod_dist` is already defined in this file. If compatibility requires the raw expression, retain it under an explicitly coordinate-dependent name and add a separate quotient-invariant residual.

### Great Scale mapping: Levels 9901–9910

- **9901 — Quotient identity:** all observables advertised as geometric on \\(\\mathbb R/9\\mathbb Z\\) must be invariant under \\(x\\mapsto x+9n\\).
- **9902 — Representative-invariance test:** test `g(x) == g(x + 9*n)` over seam and non-seam values.
- **9903 — Coordinate/geometric type separation:** raw-coordinate residuals must not be silently presented as quotient geometry.
- **9904 — Reuse the canonical metric:** use the existing `mod_dist` helper for quotient distance rather than duplicating a second distance definition.
- **9905 — Boundary regression:** assert that the represented points 0 and 9 produce the same geometric residual.
- **9906 — Periodic property test:** exercise negative coordinates, boundary representatives, and multiple positive/negative period shifts.
- **9907 — Mirror parity:** run the same property suite against every JS/CJS/Python implementation that claims the same contract.
- **9908 — Contract traceability:** link each documented invariant to at least one executable regression test.
- **9909 — Honest diagnostic semantics:** a failed quotient-invariance test invalidates the geometric interpretation, not necessarily the underlying raw diagnostic.
- **9910 — Promotion gate:** do not describe the quotient residual as fixed until the production implementation and its test oracle agree and exact-head CI passes.

### Mathematics and science

For a quotient by period 9, the metric distance is:

\\[
d_9(a,b)=\min_{n\in\mathbb Z}|a-b-9n|\in[0,4.5].
\\]

It obeys representative invariance:

\\[
d_9(a+9k,b+9m)=d_9(a,b),\qquad k,m\in\mathbb Z.
\\]

The raw absolute difference \\(|a-b|\\) does not obey this law when representatives are changed independently. Thus the correction is not cosmetic: it is the distinction between a coordinate-dependent residual and a well-defined function on the quotient space.

This is a mathematical/software contract, not a physical law. The result says nothing by itself about whether the Great Scale model is physically realized.

### Verification ledger

- **Source read:** fetched `great-scale/main/test_descent.py`; confirmed the exact `stress_residual` and `mod_dist` definitions and the existing limited residual assertions.
- **Counterexample:** follows directly from the fetched source: at x=0 the residual is 0; at x=9, `involution(9)` is 0 and the raw residual is 9.
- **Repository tests/build:** not run in this pass.
- **Live service/deployment:** not checked.
- **Cross-language implementations:** not yet compared in this pass.
- **Change scope:** this is a documentation-only proposed contract; no Great Scale runtime source was changed.

### Required next experiment

1. Add a regression that fails for the current raw residual: compare `stress_residual(x)` with `stress_residual(x + 9*n)`.
2. Decide whether the existing public name is meant to denote quotient geometry or a raw-coordinate diagnostic.
3. If geometric, change the implementation to `mod_dist(x, involution(x))` and test the Python, JS, and CJS copies.
4. Run `npm test`, `python3 test_descent.py`, and `npm run all` on the exact commit.
5. Keep the integration PR draft until these checks and exact-head hosted CI complete.

**Decision:** the earlier mathematical diagnosis is still actionable, but the fetched public test oracle has not yet encoded it. The next level is contract closure: every claimed invariant must be executable, representative-invariant, and tied to the exact artifact being tested.

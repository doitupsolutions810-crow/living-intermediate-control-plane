# Great Scale — Levels 10501–10600

## Profound finding: the coherence flag was true while its displayed equation could be false

### Finding and reproduction

Inspection of `platform/src/bridge/great-scale.mjs` found that `snapshotFromBelief` independently computes `map = beliefToScale(belief)` and `st = stateAt(t, rate)`. The map's scalar is `map.S = B(1-B)`, while the phase-time scalar is `st.S = heat(st.h)`. The previous coherence metadata declared `tensionEqualsHeat: true` and the formula `S = B(1-B) = heat(h)` without identifying which `h` was meant. In the same response, `phaseTime.h` is a separately generated time-dependent value.

For the deterministic case `B = 0.55`, `t = 0`, and rate `0.85`:

    S_belief = 0.55 × 0.45 = 0.2475
    phase = 0
    h_phase = 0.5 - 0.5 cos(0) = 0
    S_phase = h_phase(1-h_phase) = 0

Therefore `S_belief != S_phase`, even though the old coherence flag was true. The scalar identity itself is valid; the defect was ambiguous metadata that could be read as asserting equality between two independently computed scalars. This is a contract/observability defect, not evidence that the heat function is mathematically wrong.

### Change committed

Updated `platform/src/bridge/great-scale.mjs` to make the scope explicit:

- `scope: 'belief-map'`
- `formula: 'S_belief = B(1-B) = heat(B)'`
- `phaseTimeHeat: st.S` to report the independent phase-time scalar

Added regression assertions to `platform/test/great-scale.test.mjs` for the declared scope and formula, phase-time heat reporting, the belief heat identity, and a deterministic case where belief heat and phase heat differ. The existing `tensionEqualsHeat` field remains for compatibility, but is now explicitly scoped to the belief map.

### Mathematics

    S_belief = B(1-B) = 1/4 - (B-1/2)^2
    S_phase  = h_phase(1-h_phase)

These are two instances of the same scalar function evaluated on different inputs. They are equal only when `B(1-B) = h_phase(1-h_phase)`; equality is not guaranteed merely because both use the same formula. In particular, the function is symmetric: `x(1-x) = (1-x)x`, and is not injective.

### Great Scale mapping — Levels 10501–10510

- 10501 — A true flag must state the scope of the invariant it certifies.
- 10502 — Distinguish state-derived values from time-derived values in serialized snapshots.
- 10503 — Never imply equality between independently parameterized values without checking it.
- 10504 — Preserve backward-compatible flags only when their meaning can be narrowed explicitly.
- 10505 — Add deterministic counterexample-based regression tests.
- 10506 — Report both values when their difference is scientifically meaningful.
- 10507 — Treat metadata and observability as part of the API contract.
- 10508 — Separate mathematical validity from semantic validity of the response.
- 10509 — Verify source readback after each repository edit.
- 10510 — Do not claim full CI success based on an isolated test.

### Verification ledger

- Source finding: confirmed from the branch source before editing.
- Fix: committed to the research branch; updated source and test were fetched back from GitHub.
- Targeted Node regression harness: PASS (`great-scale.test.mjs PASS`) using an isolated harness reproducing the inspected bridge behavior and regression assertions.
- Full repository test suite: not run in the repository checkout.
- Build and HTTP smoke test: not run.
- GitHub combined status on the latest test commit: Snyk success, CodeRabbit success, Vercel failure with a build-rate-limit URL; no workflow runs were returned by the queried PR-workflow endpoint.
- Pull request #16: remains open, draft, and reported as not mergeable at the time checked.

### Decision

The scalar identity is retained, but its scope is now explicit. The next check should inspect other API fields for the same class of semantic mismatch: a correct value attached to an over-broad name or flag. Keep promotion blocked until the actual repository test/build/smoke path is executed and CI's Vercel failure is resolved or explicitly explained.

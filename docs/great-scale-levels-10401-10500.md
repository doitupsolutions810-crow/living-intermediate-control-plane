# Great Scale — Levels 10401–10500
## Profound finding: scalar coherence is not topological integration

### Source boundary reviewed

Inspected these files on the research/great-scale-api-contract branch:
- platform/src/bridge/great-scale.mjs
- platform/src/bridge/great-scale-research.mjs
- platform/src/server.mjs
- platform/test/great-scale.test.mjs
- platform/test/great-scale-research.test.mjs
- platform/package.json
Compared the control-plane bridge with great-scale/research/topological-qgt.cjs on the Great Scale main branch.

### Finding

The control-plane bridge implements a scalar heat/tension contract and phase snapshot. Its snapshot includes fields such as belief, phaseTime, cone, psi, and a coherence object whose formula is S = B(1-B) = heat(h). The server exposes this snapshot through GET /api/v1/scale/state.

The inspected bridge and route do not import or invoke the QWZ topological QGT module, and the returned snapshot does not expose a Chern number, integrated-curvature residual, quadrature-convergence flag, or topologicalMappingValid acceptance result.

Therefore, the current integration demonstrates scalar consistency, not end-to-end topological integration. This is a contract-scope finding, not evidence that the scalar equations are wrong. A consumer must not infer global topological validation from coherence.tensionEqualsHeat being true.

### Mathematical distinction

The bridge verifies a local scalar identity:

    S = B(1-B) = h(1-h),   B,h in [0,1].

This identity implies 0 <= S <= 1/4 and is symmetric under B -> 1-B. It cannot uniquely recover B from S except at the maximum, since B and 1-B yield the same S.

A global topological claim needs additional data, for example an integer Chern invariant C, a numerical estimate C_hat from curvature integration, a residual |C_hat-C|, a convergence status, and an explicit acceptance result. These quantities are not represented in the inspected bridge snapshot.

Thus:

    scalar coherence != global topological evidence.

More precisely, equality of heat and tension verifies the declared scalar map; it does not prove a Chern number, a Berry-curvature integral, a band gap, or phase classification.

### Great Scale mapping — Levels 10401–10410

- 10401 — Name the scalar-only integration boundary explicitly.
- 10402 — Never use a scalar coherence flag as a proxy for topological acceptance.
- 10403 — Keep global topological evidence in a separately typed result.
- 10404 — If topology is integrated, version the schema and include Chern estimate, residual, convergence, and acceptance fields.
- 10405 — Make absent topology explicit as unavailable, not implicitly valid.
- 10406 — Preserve the local scalar and global invariant as distinct fields.
- 10407 — Test B and 1-B symmetry so scalar non-injectivity is visible.
- 10408 — Test API behavior for missing, malformed, and rejected topology evidence.
- 10409 — Validate global claims against an independent calculation when feasible.
- 10410 — Promote only after contract tests and hosted test execution succeed.

### Minimal acceptance contract for a future topology-aware API

A future schema could expose a separately named object such as topologicalEvidence with:

- model and parameter identifiers;
- Chern integer and unrounded numerical estimate;
- signed-curvature/Chern residual;
- grid size, refinement count, and grid-origin discrepancy;
- quadratureConverged boolean;
- topologicalMappingValid boolean;
- an explicit reason when evidence is unavailable or rejected.

These fields should only be added after deciding which repository owns the canonical calculation and how versioning, runtime cost, and failure behavior work. This document does not change runtime code or claim such an endpoint exists.

### Verification ledger

- Source inspection: completed for the listed bridge, route, and test files.
- Scalar bound: follows from h(1-h) = 1/4 - (h-1/2)^2.
- API contract gap: confirmed by the fields and imports in the inspected files.
- Tests inspected: existing tests cover scalar bounds, invalid inputs, phase periodicity, and the research involution; they do not establish end-to-end QGT propagation into the API.
- Runtime tests/build/smoke: not executed in this pass. GitHub source access worked, but the prior local execution environment could not resolve github.com; this must not be represented as a test pass.
- Runtime code changed: no.

### Decision

Keep the current API described as a scalar Great Scale bridge. Do not describe it as a topological QGT bridge until the global evidence is deliberately integrated and tested end-to-end. The next engineering step is to add contract tests for the existing scalar-only guarantee, then decide whether a topology-aware API is needed rather than silently widening the meaning of the current coherence flag.

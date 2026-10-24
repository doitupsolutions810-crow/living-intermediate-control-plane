# Great Scale — Levels 10701–10800

## Finding: a scalar diagnostic was being presented as support for a compound hypothesis

### Evidence

In platform/src/bridge/great-scale-research.mjs, hypothesisReport(x) returned a compound hypothesis string covering heat/tension equivalence, circle reflection, a fixed point, two-cycles, cone-floor and phi zero-mode claims, and broader recursive-observation language. But its support label was computed only from one scalar:

    support = residual < 0.5 ? 'supports' : 'tensions'

where residual is the circle distance between x and its reflection.

At x = 4.5, the reflection residual is zero. That establishes that 4.5 is a fixed point of the reflection. It does not establish every other statement in the compound hypothesis. The output's scope was therefore broader than the evidence it measured.

### Mathematics

For the modulo-nine reflection R(x) = (9 - (x mod 9)) mod 9, define the circle distance

    d_9(x, R(x)) = min(δ, 9 - δ),
    δ = (x - R(x)) mod 9.

A zero residual at x = 4.5 supports the narrow statement R(4.5) = 4.5. It does not logically imply independent propositions P₁, P₂, …, Pₙ such as the heat identity, cone-floor relation, cycle preservation, or topological QGT results:

    d_9(x, R(x)) = 0  ⇏  P₁ ∧ P₂ ∧ … ∧ Pₙ.

This is an evidence-scope problem: the statistic may be correct, but the conclusion exceeds what the statistic tests.

### Correction integrated

The report keeps the existing support field for compatibility, but now returns:

- supportScope: reflection-residual-only
- claimsAssessed: the distance from the supplied coordinate to its circle reflection
- claimsNotAssessed: heat/tension identity across subsystems; cone-floor and phi zero-mode claims; all listed two-cycle properties; topological QGT and Chern-number claims.

The corresponding test now asserts the explicit scope and verifies that topological claims are marked as not assessed.

### Test/build/smoke execution boundary

I attempted to obtain full execution evidence. The container cannot resolve github.com, so a clean local clone cannot be created in this environment. GitHub readback confirms the source and test commits, but the commit-workflow-run query returns no runs for the current head. The previously reported hosted Actions run failed before any steps executed (zero steps); this is infrastructure-level evidence, not a test failure or pass.

I added .github/workflows/platform-ci.yml to run Node 22 syntax checks, npm test, a build/syntax check, and the HTTP smoke test on relevant pushes and pull requests. GitHub readback confirms the workflow file exists, but there is not yet a reported run proving those commands completed. Vercel continues to report its deployment quota limit; that deployment error does not determine whether the Node test suite passes.

Therefore:
- Committed source and test changes: verified by readback.
- Full npm test: not yet executed successfully.
- Build/syntax check: not yet executed in CI.
- HTTP smoke: not yet executed in CI.
- Deployment: blocked by Vercel quota status, separate from mathematical correctness.

### Great Scale mapping — Levels 10701–10710

- 10701 — A diagnostic supports only propositions that its observable actually tests.
- 10702 — A fixed-point residual does not validate a compound hypothesis.
- 10703 — Publish the scope of every support or tension label.
- 10704 — Separate measured quantities from interpretations.
- 10705 — Preserve compatibility only if metadata narrows the meaning honestly.
- 10706 — Mark untested claims explicitly as unassessed.
- 10707 — A correct scalar can still produce an invalid conclusion when overinterpreted.
- 10708 — Tests must assert evidence scope, not just numerical output.
- 10709 — No workflow file or commit proves a run occurred.
- 10710 — Infrastructure failure, test failure, and missing evidence are distinct states.

### Decision

The report now limits the interpretation of its support label to the reflection residual that actually determines it. Promotion remains on hold until the current committed test suite, build check, and HTTP smoke test execute on a real runner and their results are read back.

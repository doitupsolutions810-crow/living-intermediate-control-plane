# Great Scale × Control Plane — Evidence Contract (Descent XCII)

Status: integration specification, not yet an implementation claim. This document connects the existing Great Scale topological-QGT outputs to the Living Intermediate Control Plane evidence lifecycle and the Capability Authority principles. It does not claim that a signed artifact or end-to-end verifier already exists.

## Repository-grounded observations

- Great Scale's README defines the canonical phase-driven heat channel and an additive local QGT bridge; it also documents a separate global Chern channel and the command sequence `npm test`, `python3 test_descent.py`, and `npm run all`.
- The Living Intermediate Control Plane has a matching local QGT bridge and test suite, plus an evidence/attestation path. Its README describes the evidence-console public endpoint as potentially returning 404 and falling back to local authority.
- Capability Authority explicitly requires short-lived signed rights, immutable idempotency, reconcile-before-retry, and verifiable receipts. Its server records capability-issuance events, while its CI documentation distinguishes an account-level hosted-runner billing lock from a code/test failure.

These observations suggest the integration boundary should be an evidence contract, not a shared scalar or an implicit trust relationship.

## Core finding

A scientific result and permission to act on that result are different objects.

A Great Scale computation may produce a mathematically valid number while its numerical convergence gate fails. A converged computation may still be unauthenticated or stale. An authenticated result may still lack authorization for a downstream operation. Therefore, do not collapse the following into one Boolean:

1. mathematical/domain validity;
2. numerical convergence/acceptance;
3. artifact provenance and integrity;
4. caller authorization;
5. execution completion.

Use independent, explicit states and make downstream decisions depend on the required subset.

## Proposed evidence envelope

The following is a versioned contract proposal; fields are required unless marked optional.

```json
{
  "schema": "great-scale.evidence/v1",
  "claim_id": "GS-DESCENT-XCII-<stable-id>",
  "producer": {
    "repository": "owner/repository",
    "commit": "<full-commit-sha>",
    "path": "<source-or-test-path>",
    "runtime": {"node": "<version>", "python": "<version>"}
  },
  "model": {
    "name": "Qi-Wu-Zhang",
    "parameters": {"m": -1, "grid_size": 80, "grid_origin": "midpoint"},
    "conventions": {"band": "lower", "orientation": "<declared convention>"}
  },
  "claim": {
    "class": "numerical-model-result",
    "formula_version": "qgt-topological/v1",
    "assumptions": ["gapped", "pure-two-band", "periodic-Brillouin-zone"]
  },
  "result": {
    "chern_number": -1,
    "metric_area_budget": null,
    "metric_area_excess": null,
    "topological_saturation": null,
    "great_scale_scalar": null
  },
  "validation": {
    "domain_valid": true,
    "chern_integer_residual": null,
    "signed_curvature_residual": null,
    "area_refinement_residual": null,
    "grid_origin_residual": null,
    "cancellation_residual": null,
    "entropy_residual": null,
    "converged": false,
    "acceptance": "provisional"
  },
  "execution": {
    "command": "npm test",
    "exit_code": null,
    "workflow_run_url": null,
    "log_digest": null
  },
  "integrity": {
    "canonicalization": "RFC8785-or-versioned-canonical-json",
    "artifact_digest": null,
    "signature_ref": null
  }
}
```

The null values are intentionally unfilled placeholders. Never publish a fabricated value to make a record appear complete. Store exact command output or a durable log reference, and calculate digests from the exact artifact bytes after canonicalization is specified.

## Acceptance state machine

Use a monotonic, explicit state machine:

- `RECEIVED`: payload parsed; no trust implied.
- `SCHEMA_VALID`: schema/version and required fields pass.
- `PROVENANCE_VERIFIED`: repository, commit, source path, and artifact digest are bound to the submitted record.
- `DOMAIN_VALID`: mathematical domain assumptions and model gap checks pass.
- `NUMERICALLY_CONVERGED`: all configured refinement, grid-origin, signed-curvature/Chern, cancellation, and entropy residual checks pass.
- `AUTHORIZED`: caller has a valid, sufficiently scoped capability for the requested operation.
- `ACCEPTED`: every gate required by policy passes.
- `REJECTED` or `INDETERMINATE`: an explicit gate fails or cannot be established.

The state machine must not upgrade `INDETERMINATE` to `ACCEPTED` merely because a retry timed out. Reconcile the immutable request identifier against the evidence store before retrying, following Capability Authority's existing timeout/idempotency rule. Fail closed for consequential operations when the provenance, authorization, or acceptance state is unknown.

## Great Scale mathematical payload

For a converged gapped pure two-band model, preserve the full tuple rather than only the scalar:

[
mathcal A_Q=\frac{1}{2\pi}\int |F_{12}|\,d^2k,\quad
C=\frac{1}{2\pi}\int F_{12}\,d^2k,\quad
\eta_T=\frac{C}{\mathcal A_Q}.
]

[
S_T=\frac{1-\eta_T^2}{4},\qquad
\Psi_T=\phi^{-2}+S_T.
]

Retain `C`, `metricAreaBudget`, `metricAreaExcess`, `topologicalSaturation`, entropy diagnostics, residuals, and convergence flags as separate fields. The scalar is intentionally non-injective: it cannot recover the sign of (C) or the absolute metric area. The topological channel is additive and must not replace the canonical phase-driven state.

A Chern number close to an integer is not sufficient for `NUMERICALLY_CONVERGED`; the metric-area integral and grid-origin checks are separate numerical claims. The documented Richardson-style estimates are heuristics unless a rigorous error analysis is supplied.

## Security and reproducibility requirements

1. **Content-addressed evidence:** bind the evidence envelope to the full source commit SHA and digest of the canonicalized payload.
2. **Separation of duties:** a result producer must not self-grant the capability required to approve a consequential action.
3. **Least privilege:** issue short-lived, scoped capabilities; do not put bearer tokens in evidence artifacts or logs.
4. **Idempotency:** use one immutable request/idempotency key per control-plane request; reconcile after timeout before retrying.
5. **No silent fallback to trust:** local evidence-console fallback may preserve availability but must not silently turn missing remote evidence into a verified remote attestation.
6. **Truthful CI semantics:** distinguish test assertion failure, infrastructure failure, billing/account lock, and missing workflow evidence. A missing or inaccessible log is not a pass and is not proof of a code failure.
7. **Auditability:** retain source commit, exact commands, exit codes, runtime versions, test counts, acceptance policy version, and durable log digest.
8. **Schema evolution:** reject unknown major schema versions; record compatibility decisions for minor versions.

## Verification plan before implementation is considered complete

- Contract tests: missing SHA, malformed digest, unknown schema version, missing numerical residual, invalid enum, and inconsistent scalar/tuple values are rejected.
- Scientific tests: `C=-1,+1,0` reference phases; transition masses rejected; `|C| <= A_Q`; cancellation identity; sign reversal preserves scalar but reverses signed topology; area and entropy convergence gates enforced.
- Security tests: unauthorized capability, expired capability, wrong audience, replayed idempotency key with changed payload, and timeout/reconcile path.
- Integration tests: evidence producer → envelope validation → provenance check → numerical gate → capability authorization → immutable receipt.
- Failure-injection tests: unavailable evidence-console, absent logs, missing CI run, stale commit, malformed signature, and retry after unknown execution outcome must not yield `ACCEPTED`.

## Evidence registry record

- Claim ID: `LICP-GS-EVIDENCE-CONTRACT-XCII`
- Type: cross-repository architecture and verification proposal
- Sources: `doitupsolutions810-crow/great-scale`, `doitupsolutions810-crow/living-intermediate-control-plane`, `doitupsolutions810-crow/capability-authority`
- Status: proposal only; not an implemented or tested end-to-end path
- Required next proof: contract schema + tests, capability-bound receipt implementation, and recorded successful integration run

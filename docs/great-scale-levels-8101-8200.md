# Great Scale — Levels 8101–8200: authorization is not execution

## Profound finding

A deeper audit of the Capability Authority implementation reveals a semantic gap more fundamental than replay safety: the HTTP route `POST /v1/execute` returns `result: "executed"` and signs a receipt with `outcome: "ok"`, but the inspected `Executor.execute` implementation only verifies the capability, checks bounds, applies an in-memory rate limit, and creates the receipt. It does not call a resource adapter, provider, or action handler in the inspected code path.

This means the inspected implementation can establish “the request passed authorization checks” but does not visibly establish “the requested external effect occurred.” The receipt's `outcome: "ok"` is therefore stronger than the observable execution evidence supports in this path.

This is a source audit, not a claim about external integrations or other uninspected deployment layers. No external action provider was present in the inspected `Executor.execute` method.

## Source chain

- `plane_service/server.py`: `handle_execute` passes capability, signature, required action, and caller to `executor.execute`. On success it emits an `ExecuteReceipt` evidence event.
- `plane_service/executor.py`: `Executor.execute` validates revocation, signature, bounds, authorization, and rate limit; it then signs a receipt containing capability ID, executor ID, action string, outcome, and timestamp, and returns `{"status":"ok","result":"executed","receipt":...}`.
- The inspected method contains no dispatch to an action-specific provider and no provider result to reconcile. The HTTP server returns this result as a successful response.
- The receipt's action string is derived from `required.type` and `required.resource`, but the inspected receipt does not bind a stable request ID, canonical payload digest, provider operation ID, provider response, or verified resulting-state digest.
- `_record_evidence` catches evidence-index and bus exceptions and logs that ingestion was skipped. That is useful best-effort telemetry, but it is not proof that the external effect occurred or that evidence was durably committed.
- The README promises that every executed act leaves a verifiable receipt and that timeouts are reconciled before retry. Those requirements are not demonstrated end-to-end by this inspected handler/executor path.

## Mathematics: three propositions, not one

Let (A) be the authorization predicate, (D) the actual dispatch to an external effect, (O) the provider's observed outcome, and (R) a signed receipt.

The inspected flow establishes something of the form:
\[
A(c,u)=\text{true}\Rightarrow \operatorname{sign}(R(c,u,\text{ok},t)).
\]

But the operational claim needs a stronger implication:
\[
\operatorname{receipt}(R)\land\operatorname{verified}(R)
\Rightarrow \operatorname{bound}(R,k,d)\land
\operatorname{reconciled}(O)\land\operatorname{stateEvidence}(O).
\]

A signature authenticates the signed fields; it does not magically prove an omitted physical or external event. If the executor did not dispatch the action, a signed `outcome: ok` is only a signed assertion produced by the executor.

Define the action lifecycle:
\[
\text{authorized}\to\text{dispatched}\to
\text{provider outcome known}\to\text{reconciled}\to\text{receipt issued}.
\]
A timeout after dispatch yields an unknown state, not a failure or success:
\[
\text{timeout}\Rightarrow O\in\{\text{committed},\text{not committed},\text{unknown}\}.
\]
Only provider reconciliation or a contractually equivalent source of truth can collapse that uncertainty.

## Great Scale mapping

**Level 8101 — Authorization is a predicate.** A valid capability proves the caller is allowed to request an action under policy; it does not prove the action occurred.

**Level 8102 — Dispatch is a distinct event.** A concrete adapter must map an authorized action type/resource to a controlled provider call. Unknown action types must fail closed.

**Level 8103 — Outcome comes from the effect boundary.** The executor must derive success/failure/unknown from the adapter/provider result, not synthesize `ok` immediately after authorization.

**Level 8104 — Receipt truth is bounded by observations.** A receipt must never assert a stronger outcome than the evidence it binds.

**Level 8105 — Request identity binds the whole lifecycle.** Stable request ID (k) and canonical payload digest (d=H(C(u))) must accompany authorization, dispatch, provider reconciliation, and receipt issuance.

**Level 8106 — Timeout is epistemic uncertainty.** A timeout is not proof of failure. Reconcile by provider idempotency key or operation ID before retrying.

**Level 8107 — Receipt schema is an evidence contract.** Bind (k,d), capability ID, action/resource, provider, provider operation ID, outcome classification, timestamp, and result/evidence digest where available.

**Level 8108 — Evidence publication is not execution.** Best-effort index/bus publication must not be confused with the provider's result or the authoritative operation ledger.

**Level 8109 — Fail-closed unknowns.** If the action provider or reconciliation source cannot establish the outcome, return `unknown/pending`, not `ok`; retain an operation ID for later reconciliation.

**Level 8110 — Cross-plane release gate.** The Scale state transition, capability authorization, provider effect, idempotency record, and receipt must share a single stable operation identity and an explicit recovery protocol.

## Integration recommendation

Do not merely rename `result: "executed"` to another string. The contract needs an explicit adapter boundary:

1. Resolve a known action type/resource to a registered adapter; deny unknown mappings.
2. Verify capability, constraints, caller, and request identity before dispatch.
3. Pass the immutable idempotency key and canonical payload digest to the provider where supported.
4. Persist a pending operation before dispatch, then store the provider operation ID and reconciled outcome.
5. On timeout, return `pending/unknown` with operation ID and reconcile before any retry.
6. Issue a signed receipt only from the reconciled outcome; include request identity, payload digest, provider operation ID, outcome, and result digest.
7. Publish evidence asynchronously or transactionally according to an explicit durability contract, but do not use evidence-index success as a proxy for the action itself.

For actions that have no external effect by design, rename and document this endpoint as an authorization simulation or dry-run and issue a receipt that says `authorized` or `simulated`, not `executed`.

## Test / verify / run plan

1. Authorized request to an unregistered action/resource is denied and no success receipt is issued.
2. Registered fake adapter records exactly one dispatch and returns a deterministic provider operation ID.
3. Receipt outcome reflects adapter outcomes: success, rejection, and unknown/pending.
4. Simulated timeout after provider commit is reconciled by the same idempotency key and does not dispatch a second effect.
5. Provider failure never yields `outcome: ok`.
6. Verify the signed receipt's request ID and digest match the exact canonical request.
7. Evidence index/bus failure does not falsely transform a provider success into a provider failure or erase the recoverable operation.
8. Restart test confirms pending operations can be reconciled from durable state.
9. Unauthorized or revoked capability causes zero adapter calls.
10. Run `bash scripts/run_ci_local.sh` in the capability-authority repository and the Scale platform suite separately; report actual outputs and environment limitations.

## Verification ledger

- **Verified by source inspection:** `Executor.execute` checks capability validity/bounds/rate limit, signs `outcome: "ok"`, and returns `result: "executed"` without a visible action adapter/provider call in that method.
- **Verified by source inspection:** `handle_execute` records a reduced evidence event after executor success; evidence ingestion failures are caught and logged.
- **Not established:** whether another external layer wraps this endpoint and performs effects outside the inspected repository path.
- **Not run:** local repository test suite, adapter tests, provider timeout/reconciliation tests, restart durability tests, or live external actions.
- **No runtime code changed by this document-only integration.** The existing research PR remains draft and unmerged; no deployment was attempted.

This is an execution-semantics finding: authorization, external effect, and evidence are three different claims and must remain distinguishable in API responses and signed receipts.

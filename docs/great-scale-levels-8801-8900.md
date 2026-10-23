# Great Scale Descent — Levels 8801–8900
## Finding: Reconciliation has no end-to-end identity to reconcile

### Scope and confidence

This is a source-level audit of the public `main` branch of `doitupsolutions810-crow/capability-authority`, inspected through GitHub on 2026-10-22. It is not a penetration test and does not establish production exploitability. Production provider adapters, Postgres/JetStream wiring, ingress, and deployed runtime behavior were not independently inspected or exercised.

### 1. The deeper finding

The repository documents a strong operational rule in `README.md`: “Timeout = unknown → reconcile before retry” and “One immutable provider idempotency key per control-plane request id.” Yet the inspected path does not carry that identity from request to provider effect to receipt:

- `plane_service/server.py::handle_execute` extracts only capability, signature, required right, and caller from the request body. It does not extract or validate a control-plane `request_id`, canonical request digest, or provider idempotency key.
- `plane_service/executor.py::Executor.execute` checks authorization and rate limits, then locally creates a signed receipt with capability ID, executor ID, action, outcome, and timestamp. It does not dispatch to a visible provider adapter and does not include a request ID, provider request ID, or canonical payload digest.
- `server.py::handle_execute` emits an `ExecuteReceipt` evidence event containing only capability ID, action, and outcome. The event omits the correlation fields needed to join it to a particular request or provider operation.
- `evidence/index.py::EvidenceIndex.query` can filter by `request_id`, but the inspected execute event does not supply one. A query parameter existing in the index is not proof that the producer emits that identifier.
- `admin/reconcile.py` says to reconcile by `provider_request_id` and to treat timeout as unknown, but the inspected classifier only maps an already-provided outcome to a state and next action. It does not itself establish the provider request ID, issue the provider lookup, or prove a retry is bound to the original effect.
- `admin/idempotency.py` has a request-ID-based key helper, but its store is a process-local dictionary and `put` overwrites a key without comparing canonical payload digests. This helper is not connected to the inspected execute path.

**Profound conclusion:** the design has a reconciliation *policy*, but the inspected execution path does not establish a reconciliation *identity chain*. If an external effect can happen and the caller times out, safe recovery requires the same stable identity to survive from accepted request, through provider dispatch, to provider lookup and durable receipt. Without that chain, “unknown → reconcile” may be impossible to perform deterministically, and a retry can neither be proven safe nor proven to be the same operation. This conclusion is limited to the inspected source path; an uninspected external adapter or production layer could add the missing linkage.

This is more specific than saying “the store is in memory”: even a durable database cannot reconcile an operation if the durable record and provider request are not bound by the same immutable key and digest.

### 2. Required end-to-end contract

Let:
- (r) be a unique control-plane request ID;
- (q) be the complete canonical operation, including capability ID, authenticated principal, method, resource, constraints, and policy epoch;
- (d = H(\operatorname{Canonicalize}(q))) be its digest;
- (p = F(r)) be a deterministic provider idempotency key derived once from (r), scoped to the provider and operation domain;
- (e) be the provider's operation identity/result;
- (L) be the durable control-plane ledger.

A valid dispatch protocol should establish, before the external effect:
[
\operatorname{Reserve}(r,d,p) \in L
]
with a uniqueness constraint on (r) and immutable binding (r\mapsto(d,p)). Then:

[
(r,d)=(r',d') \Rightarrow \text{same logical operation and same }p
]
[
r=r' \land d\ne d' \Rightarrow \text{reject key reuse}
]
[
\operatorname{Timeout}(r) \Rightarrow \operatorname{LookupProvider}(p)
\quad\text{before any retry}
]

A receipt should bind ((r,d,p,\text{capability ID},\text{policy epoch},\text{provider operation ID},\text{observed status})). Its status must distinguish at least:
- `authorized`: policy and capability checks passed;
- `dispatch_attempted`: provider call was issued with key (p);
- `provider_confirmed`: provider result was observed and tied to (p);
- `ledger_committed`: the result and receipt are durably recorded.

A locally signed `outcome: ok` cannot imply provider success unless the provider response was observed and correlated. Signatures protect receipt integrity; they do not supply missing causality.

### 3. Great Scale mapping

Use the Great Scale contraction form
[
x_{n+1}=x^*+k(x_n-x^*),\qquad |k|<1
]
as an analogy for convergence of recovery state. Let (x_n) represent the uncertainty about one operation after the (n)-th reconciliation attempt, and (x^*) represent its uniquely determined terminal state (confirmed success or confirmed failure).

A contraction claim would require an actual update rule satisfying
[
|x_{n+1}-x^*|\le |k|\,|x_n-x^*|,\qquad |k|<1.
]
The code must first make (x_n) refer to the *same operation* at every step. If each retry can create a new provider key, or the evidence record cannot be joined to the provider operation, then the state variable silently changes identity; the contraction premise is not met. Therefore this is a useful falsifiable design criterion, not a proof that the implementation converges.

The existing Great Scale constants are mathematical context only:
[
\mathrm{CONE}=\varphi^{-2}=(\varphi-1)^2\approx0.381966,
\qquad \Psi=\mathrm{CONE}+h(1-h),\quad h\in[0,1].
]
Neither these constants nor a bounded-variance inequality can compensate for a missing request/effect identity binding. Security and distributed-systems invariants must remain hard constraints, separate from model scores.

### 4. Falsifiable tests

These tests are proposed, not run against the repository:

1. **Correlation completeness:** submit one request and assert the same `request_id`, canonical digest, provider idempotency key, provider operation ID, and capability ID can be joined across request reservation, dispatch, provider lookup, receipt, and evidence ledger.
2. **Timeout recovery:** simulate provider success followed by client timeout. Recovery must query the provider with the original key, return the original result/receipt, and issue no second effect.
3. **Ambiguous provider outcome:** simulate a timeout with no provider lookup result. Keep state `unknown`; do not mint a new key or report success.
4. **Payload collision:** reuse request ID with a different method, resource, constraints, audience, or policy epoch. Reject before provider dispatch.
5. **Concurrent duplicate:** two workers submit the same request simultaneously. A durable uniqueness constraint and provider idempotency must yield one logical operation and one canonical receipt.
6. **Ledger failure:** if the provider has acted but durable receipt commit fails, recovery must retain the original provider key and reconcile; it must not claim a committed result or issue a new operation.
7. **Signature semantics:** verify that a signed receipt containing `outcome: ok` is issued only after an observed provider-confirmed result, and that the signature covers all correlation fields and status transitions.

### 5. Verification ledger

- **Read and compared:** `README.md`, `plane_service/server.py`, `plane_service/executor.py`, `admin/idempotency.py`, `admin/reconcile.py`, and `evidence/index.py` on `main`.
- **Source-level result:** README promises stable provider-key reconciliation, but the inspected execute handler, executor receipt, and evidence event omit the identity fields required to demonstrate that end-to-end guarantee.
- **Search result:** repository code search for `provider_request_id` and `request_id` returned no matches in the indexed default-branch code. Direct file inspection is the primary evidence; search-index absence alone is not proof of repository-wide absence.
- **Tests / run / build:** not run. This change is documentation-only; no local clone/runtime was available in this work session.
- **CI / deployment:** must be checked separately; no CI result is treated as a pass, and production configuration was not verified.
- **Remediation order:** (1) define canonical request schema and digest; (2) durably reserve request ID and immutable provider key before dispatch; (3) thread correlation fields through provider adapter and signed receipt; (4) implement provider lookup/reconciliation on timeout; (5) make concurrent duplicate and payload-collision tests mandatory; (6) document lab versus production guarantees.

### 6. Source references

- `README.md`: timeout/reconcile and immutable provider idempotency requirements.
- `plane_service/server.py::handle_execute`: request extraction and evidence event construction.
- `plane_service/executor.py::Executor.execute`: authorization and local receipt generation, with no visible provider dispatch.
- `admin/idempotency.py`: process-local key/result mapping and overwrite semantics.
- `admin/reconcile.py`: outcome classification and intended provider lookup action.
- `evidence/index.py::EvidenceIndex.query`: supports request-ID filtering, while inspected execute producer omits the ID.

**Disposition:** integrate this as a source-audit finding in the existing draft PR. Do not change runtime behavior until the actual provider adapter and production persistence contract are located and tests can prove the invariants.

# Great Scale Descent — Levels 8901–9000
## Finding: A simulated plan can become a terminal success

### Scope and confidence

This is a source-level audit of the public `main` branches of `doitupsolutions810-crow/capability-authority` and `doitupsolutions810-crow/capability-plane`, inspected through GitHub on 2026-10-22. No live cluster, provider, local clone, or production deployment was exercised. The finding is directly supported by the adapter and classifier source; impact in a deployed workflow depends on whether these exact modules and states are used downstream.

### 1. The deeper finding

In `capability-authority/admin/providers/kubernetes_adapter.py`, the Kubernetes adapter builds an isolation plan. With `K8S_LIVE` unset or not equal to `1`, it returns `status: "planned"`. Even when `K8S_LIVE=1` and `ALLOW_ADMIN_DESTRUCTIVE_ACTIONS=true`, it returns `status: "applied-lab"` with the explicit note `"wire kubectl apply only in a real cluster"`. The inspected method contains no Kubernetes API call or `kubectl apply`.

But `capability-authority/admin/reconcile.py::classify` maps all of `"ok"`, `"applied"`, and `"applied-lab"` to `"succeeded"`.

Therefore, **the classifier can assert a terminal success state for a result that explicitly says no live infrastructure mutation was performed**. This is not just missing telemetry: it is a semantic collapse between a proposed action, a lab-mode acknowledgement, and an observed external effect. A caller consuming only the reconciled state can mistake “plan generated” for “resource isolated.”

Related integration boundary: `capability-plane/admin/providers/factory.py` imports `.base`, `.generic`, and `.kubernetes_adapter`, but the inspected public `main` tree contains only `admin/providers/factory.py`; those imported modules are absent from that tree. Its factory also imports `admin.admin_action` and `admin.suspend_tenant`, which are absent from that tree. `NOTE_FULL_TREE.md` itself says full-stack sources are in a separate local release zip. This means the public `capability-plane` tree alone does not reproduce the complete admin execution path described by its factory. The complete provider modules found in `capability-authority` confirm that the adapter's current Kubernetes behavior is plan/lab-oriented, not proof of production actuation.

The separate `capability-plane/admin/durable_outbox.py` is SQLite-backed despite its “production” framing in the module docstring; its `jetstream_publish_fn` prints a publish message and optionally mirrors into the in-process AttestPipe bus. That code does not itself establish a real JetStream publish or a Postgres transaction. A production deployment may supply external wiring, but that wiring was not verified.

**Profound conclusion:** authorization, plan generation, provider acknowledgement, observed external effect, and durable evidence are different facts. The current `applied-lab → succeeded` mapping erases those distinctions exactly at the point where reconciliation is supposed to restore truth after uncertainty.

### 2. Required state contract

Use distinct terminal semantics:

- `denied`: policy gate rejected the operation.
- `planned`: a valid plan exists; no external mutation has been claimed.
- `dispatch_attempted`: a provider request was actually sent with a stable provider request ID.
- `provider_confirmed`: a provider read-back or authoritative response confirms the requested postcondition.
- `unknown`: outcome cannot yet be established; reconcile with the original provider request ID.
- `failed`: provider or policy has definitively rejected/failed the operation.
- `succeeded`: the required postcondition was independently observed and the result was recorded in the durable ledger.

In particular, `applied-lab` must not map to `succeeded` unless the word “success” is explicitly scoped to a lab simulation and is never used as production-effect status. Prefer a separate enum such as `simulation_completed`.

Let (A) be authorization, (P) plan construction, (D) dispatch, (O) observed postcondition, and (L) durable evidence commit. The implication that a safe system needs is:

\[
\mathrm{Succeeded} \Rightarrow A \land P \land D \land O \land L.
\]

The reverse implication may require domain-specific checks, but the forward implication is non-negotiable: a signed or classified success cannot be stronger than the evidence actually observed. In particular,

\[
P \not\Rightarrow D, \qquad D \not\Rightarrow O, \qquad O \not\Rightarrow L.
\]

### 3. Great Scale mapping

Keep the Great Scale contraction model

\[
x_{n+1}=x^*+k(x_n-x^*), \qquad |k|<1
\]

as an analogy for reconciliation reducing uncertainty. Let (x_n) be the belief state about whether a specific resource is isolated; (x^*) is the actual postcondition state. A valid reconciliation update must be based on a provider observation tied to the same immutable request identity.

If a simulated `applied-lab` outcome is mapped directly to `succeeded`, the estimator has set uncertainty to zero without measuring the external state. This is not contraction; it is an unsupported state assignment. The apparent convergence is a reporting artifact, not a property of the system.

The project constants remain visible but are not evidence of correctness:

\[
\mathrm{CONE}=\varphi^{-2}=(\varphi-1)^2\approx0.381966,
\qquad
\Psi=\mathrm{CONE}+h(1-h),\quad h\in[0,1].
\]

No choice of `CONE`, heat (h), or confidence score can make a planned operation into an observed infrastructure effect. Keep model feasibility, policy authorization, provider effect, and evidence validity as separate predicates.

### 4. Falsifiable tests

These tests are proposed and have **not** been run against the repository:

1. **Plan is not success:** invoke the Kubernetes adapter with `K8S_LIVE=0`; assert `classify(adapter_result)` is not `succeeded`.
2. **Lab is not production success:** set `K8S_LIVE=1` and `ALLOW_ADMIN_DESTRUCTIVE_ACTIONS=true`; the current adapter returns `applied-lab` without a provider API call. Assert the production state remains `simulation_completed` or `unknown`, not `succeeded`.
3. **Provider read-back:** stub a provider mutation and read-back. Only classify `succeeded` when the read-back confirms the requested resource postcondition for the same provider request ID.
4. **Timeout:** simulate timeout after dispatch. Preserve `unknown`, reconcile using the original provider request ID, and prohibit a new key before lookup.
5. **Outbox payload collision:** enqueue the same `(event_type, aggregate_id)` with a different payload. Reject the conflicting payload rather than silently returning the pre-existing event.
6. **Concurrent relay:** run two relay workers against one unpublished event. Ensure duplicate delivery is tolerated by an idempotent consumer and that claim/lease semantics or deduplication are explicit.
7. **Release completeness:** in a clean checkout of `capability-plane` at `main`, verify every import in `admin/providers/factory.py` resolves and the documented quick start references files that are present. If the release zip is a required overlay, make it a versioned, reproducible build input and test it.

### 5. Verification ledger

- **Inspected:** `capability-authority/admin/providers/kubernetes_adapter.py`, `admin/reconcile.py`, `admin/providers/generic.py`, `admin/providers/factory.py`, `admin/idempotency.py`, and `admin/outbox.py`; plus the recursive public `main` tree and `NOTE_FULL_TREE.md` of `capability-plane`, and `capability-plane/admin/durable_outbox.py`.
- **Source-level result:** `applied-lab` is classified as `succeeded` although the adapter explicitly says real `kubectl apply` is not wired. Public `capability-plane` also omits modules imported by its provider factory and documents an external release overlay.
- **Tests / run / build:** not run. The local environment cannot resolve GitHub for cloning, and no hosted test result was treated as proof of this source-level behavior.
- **CI / deployment:** not verified for this finding. No production cluster or provider was contacted.
- **Recommended order:** (1) separate simulation from effect statuses; (2) require provider read-back for success; (3) bind state to immutable request/provider IDs; (4) make outbox/ledger durability and delivery semantics explicit; (5) package a complete reproducible release; (6) add the falsifiable tests above before changing runtime behavior.

### 6. Source references

- `capability-authority/admin/providers/kubernetes_adapter.py`: returns `planned` by default and `applied-lab` under the live/destructive flags, with a note that real `kubectl apply` remains unwired.
- `capability-authority/admin/reconcile.py::classify`: treats `applied-lab` as `succeeded`.
- `capability-authority/admin/providers/generic.py`: explicitly reports `planned`, not live mutation.
- `capability-plane/admin/providers/factory.py`: imports provider and orchestration modules not present in the inspected public tree.
- `capability-plane/NOTE_FULL_TREE.md`: states that complete sources are in a separate local release zip.
- `capability-plane/admin/durable_outbox.py`: SQLite local outbox and a publish function that logs and optionally mirrors to AttestPipe; not proof of production JetStream/Postgres wiring.

**Disposition:** add this as a source-audit finding to the existing draft PR. Do not promote lab status to production success or claim the production effect without provider read-back and tests.

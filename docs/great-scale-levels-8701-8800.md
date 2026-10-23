# Great Scale Descent — Levels 8701–8800
## Finding: Authority is not a single state machine

**Scope and evidence.** This is a source-level audit of the public `main` branch of `doitupsolutions810-crow/capability-authority`, read through GitHub on 2026-10-22. It is not a penetration test and does not establish production exploitability. Production Postgres/JetStream, ingress, gateway, and deployment behavior were not independently inspected or exercised.

### 1. New finding

The capability lifecycle is represented by multiple state holders with different persistence and enforcement semantics:

- `plane_service/executor.py`: revocation list is an in-memory `set()`; rate-limit windows are in-memory queues. `execute()` checks `cap.get("id") in self.crl`, but the inspected HTTP routes expose issue, attenuate, verify, execute, agent mount/spawn/list and no revocation mutation endpoint.
- `agents/runtime.py`: `REGISTRY` is an in-memory dictionary-backed registry; parent/child relationships are process-local.
- `admin/idempotency.py`: `IdempotencyStore` is an in-memory dictionary. `put` overwrites a key without checking a canonical request digest or rejecting key reuse with different payload.
- `admin/outbox.py`: the implementation is a local list; its docstring says production uses Postgres + JetStream, which is a stated deployment intention, not evidence of deployed behavior.
- `plane_service/server.py::_record_evidence`: evidence-index and bus errors are caught and logged; issue/execute can still return success when those evidence writes fail.
- `plane_service/core.py::verify`: authorization checks expiry and audience, then matches right `type` and `resource`, but not `method`. This compounds the previously recorded authorization-projection finding.

**Core conclusion:** the inspected code does not establish one durable, linearizable authority state that every execution decision consults. A local revocation set cannot by itself prove fleet-wide revocation; process-local idempotency cannot by itself prove retry safety across restarts/replicas; and best-effort evidence cannot by itself prove a complete act ledger. These are distinct gaps, not one confirmed production exploit. Deployment-provided shared stores or gateway controls could mitigate them, but were not verified here.

### 2. Lifecycle contract that should hold

Let a capability be (c), a canonical action request be (q), a policy epoch be (e), revocation state be (R_e), and durable ledger be (L).

Define:
- (H(q)): digest of a canonical serialization of the complete request, including method, resource, constraints, audience, and relevant policy version.
- (Active(c,e)): signature and bounds are valid, (c) has not expired, its policy epoch is accepted, and it is not revoked at epoch (e).
- (Allowed(c,q,e)): the authenticated principal matches the audience and the full right tuple ((type, resource, method)) and constraints permit (q).
- (Commit(k,H(q),r,e)): an atomic durable idempotency/ledger record binds request key (k), digest, policy epoch and result/receipt (r).

Required invariant:
[
Accept(c,q) Rightarrow Active(c,e) land Allowed(c,q,e)
]
For retries:
[
k_1=k_2 land H(q_1)=H(q_2) Rightarrow r_1=r_2
]
and
[
k_1=k_2 land H(q_1)
e H(q_2) Rightarrow Reject
]
For revocation with a declared effective epoch (e_r):
[
e ge e_r land c.id in R_e Rightarrow Reject(c,q)
]
For an externally effectful operation, a signed receipt should assert only what is observed: authorization, dispatch attempt, provider-confirmed result, and durable evidence are different events. A signature authenticates a receipt's bytes; it does not independently prove an external side effect happened.

### 3. Great Scale mapping

Use the project's contraction form (x_{n+1}=x^*+k(x_n-x^*)), (|k|<1), as a model for convergence of distributed authority state—not as a claim that a software system automatically converges.

Let (x_n) encode the difference between replicas' authority views and (x^*) be the canonical committed view. A contraction bound
[
|x_{n+1}-x^*| le |k|,|x_n-x^*|,quad |k|<1
]
would imply eventual convergence of replicas only if the update protocol actually satisfies the bound and has a unique committed authority source. The inspected in-memory structures do not establish either precondition. Therefore **do not infer convergence from the Great Scale equation**; make convergence a measured and tested system property.

For the bounded-variance analogy, if a normalized policy-validity score (Pin[0,b]) is used for risk aggregation, the correct bound is
[
operatorname{Var}(P)le mathbb E[P](b-mathbb E[P])
]
not the generic unit-support bound unless (b=1). This is only an optional risk-model constraint; it cannot replace hard authorization invariants.

The project's constants remain mathematical context rather than security evidence:
[
\mathrm{CONE}=\varphi^{-2}=(\varphi-1)^2\approx0.381966,quad
\Psi=\mathrm{CONE}+h(1-h),quad h\in[0,1].
]
No claim is made that these constants prove correctness or safety of the capability system.

### 4. Test plan / falsifiable verification

These are proposed tests, **not run against the repository**:

1. **Revocation across replicas/restarts:** issue capability (c), revoke it, restart executor and route the same signed capability to every replica; all replicas must reject after the declared revocation epoch.
2. **Idempotency collision:** submit same request key with identical canonical payload; obtain same receipt. Reuse key with different method/resource/constraints; reject without a second provider call.
3. **Method non-amplification:** a right for `read` must not satisfy `delete` for the same type/resource; both verify and execute paths must enforce the same full tuple.
4. **Ledger fail-closed semantics:** force evidence/outbox persistence to fail. For operations requiring an auditable commit, return no success unless durable commit or recoverable transactional-outbox state exists.
5. **Concurrent replay:** send identical key concurrently to two workers; prove one provider effect and one canonical receipt.
6. **Agent restart/delegation:** spawn a child, restart the process, and verify that parentage, delegation depth, and revocation semantics are restored consistently—or explicitly declare agent handles ephemeral and ensure they cannot authorize durable actions.
7. **Receipt semantics:** independently verify receipt signature and distinguish `authorized`, `dispatch_attempted`, `provider_confirmed`, and `ledger_committed`; never infer provider success from a locally generated `outcome: ok` alone.

### 5. Verification ledger

- **Source read:** `core.py`, `executor.py`, `server.py`, `bounds.py`, `policy.py`, `agents/runtime.py`, `agents/spawn.py`, `admin/idempotency.py`, `admin/outbox.py`, `admin/reconcile.py`, and `admin/approvals.py` inspected on `main`.
- **Source-level result:** lifecycle state is split across process-local stores; evidence publication is best-effort; method is omitted from the inspected authorization predicate.
- **Test / run / build:** not run. No local clone/runtime available in this work session; this change is documentation-only.
- **CI:** must be checked after commit; absence of checks is not a passing test.
- **Deployment:** not verified.
- **Recommended remediation order:** (1) canonicalize and enforce full action rights; (2) establish authenticated caller identity on verify/execute; (3) introduce shared durable revocation and idempotency records with atomic uniqueness/digest checks; (4) define transactional receipt/outbox semantics; (5) add replica/restart/concurrency regression tests; (6) document which guarantees are local-lab versus production-backed.

### 6. Evidence references

- `plane_service/core.py` — rights attenuation uses `(type, resource, method)`; verification uses only `type, resource`.
- `plane_service/executor.py` — in-memory `crl` and rate limiter; locally signed `outcome: ok` receipt.
- `plane_service/server.py` — routes and best-effort `_record_evidence`.
- `agents/runtime.py`, `agents/spawn.py` — process-local registry and child delegation.
- `admin/idempotency.py`, `admin/outbox.py`, `admin/reconcile.py` — local data structures and timeout classification.

**Disposition:** research finding integrated into the existing draft PR; no runtime code changed and no claim of test, build, or production validation.

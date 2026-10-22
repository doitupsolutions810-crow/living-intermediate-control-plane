# Great Scale — Levels 8001–8100: commit semantics must match the evidence semantics

## Profound finding

The deeper audit across `living-intermediate-control-plane` and `capability-authority` reveals a second-order contract gap: the orchestration route labels a response `provisional: true` after it has already mutated the live state, while the companion authority repository has an in-memory idempotency helper but the inspected executor path does not use it.

This is stronger than “the Scale route lacks an idempotency header.” The two repositories currently expose ingredients that look like a transaction protocol—an idempotency key abstraction, a signed receipt, and an evidence index—but the inspected execution path does not bind them into one durable state transition.

### Source observations

1. In `platform/src/server.mjs`, `POST /api/v1/scale/step` calls `resonant.tick(nextBelief)` and then returns `provisional: true`.
2. In `platform/src/audio/living-intermediate.mjs`, `tick` assigns `this.belief`, updates the partials, appends a frame to in-memory history, and returns the frame. It is a state mutation, not a pure preview.
3. In `capability-authority/admin/idempotency.py`, `IdempotencyStore` is a plain Python dictionary. It is process-local and has no visible durable persistence or payload-digest comparison.
4. In `capability-authority/plane_service/executor.py`, `Executor.execute` verifies a capability and signs a receipt, but the inspected method does not accept a request ID/idempotency key or persist a replay result. The receipt binds capability/action/outcome/timestamp; it does not bind a caller request ID or payload digest.
5. In `capability-authority/plane_service/server.py`, `handle_execute` records an `ExecuteReceipt` evidence event with capability ID, action, and outcome. The event as constructed does not include a stable request ID or payload digest. The server's evidence calls can be skipped on exceptions, so evidence indexing should not be treated as the atomic commit boundary.
6. The README declares stronger intended rules: immutable idempotency, reconcile-before-retry, and verifiable receipts. The inspected implementation paths do not yet demonstrate those guarantees end-to-end.

These are source-level observations, not proof that no other branch or external deployment layer provides a missing guarantee. The documented contract and the inspected paths are not yet demonstrably aligned.

## Mathematical contract: proposal, commit, evidence

Let the live state be (x_n), request payload be (u), stable request identity be (k), and canonical payload digest be (d=H(C(u))).

A proposal is a pure computation:
\[
p = T(x_n,u).
\]

A commit is a single state transition with an outcome record:
\[
(x_{n+1},v,r) = \operatorname{commit}(k,d,p),
\]
where (v) is a monotonically increasing state version and (r) is the receipt.

Required replay law:
\[
\operatorname{execute}(k,d)=
\begin{cases}
r, & (k,d)\text{ already committed},\\
\text{reject}, & k\text{ exists with }d'\ne d,\\
\operatorname{commit}(k,d,p), & k\text{ is new and authorization succeeds}.
\end{cases}
\]

The state mutation and durable idempotency record must share a transaction boundary, or be connected by a recovery protocol that proves which side committed. A signed receipt alone proves only that some issuer signed its contents; it does not prove the state transition and replay ledger were committed atomically.

A `provisional` flag is semantically valid only if the operation is actually a non-mutating proposal, or if the response explicitly means “committed, awaiting later verification” and provides a durable operation ID. It must not ambiguously mean both.

## Great Scale mapping

**Level 8001 — Proposal/commit separation.** A preview computes (T(x,u)) without mutating (x); a commit advances the authoritative state.

**Level 8002 — State mutation is observable.** In-memory belief, partials, and history all change during `tick`; response labels do not reverse those writes.

**Level 8003 — Stable operation identity.** Every state-changing request has a stable (k), independent of HTTP connection identity.

**Level 8004 — Payload binding.** A canonical digest (d=H(C(u))) prevents a caller from reusing (k) for a different operation.

**Level 8005 — Atomicity.** State version, idempotency record, and committed result must be atomic or recoverably coordinated.

**Level 8006 — Receipt completeness.** A receipt should bind (k), (d), actor/capability, outcome, prior and resulting version, and resulting-state digest.

**Level 8007 — Evidence is not the commit.** An asynchronous evidence event or best-effort index is not an atomic commit record unless durability and recovery semantics explicitly establish that fact.

**Level 8008 — Idempotency-store reality check.** A process-local dictionary does not establish crash durability, cross-worker uniqueness, or concurrent duplicate exclusion.

**Level 8009 — “Provisional” has one meaning.** It must denote either a pure proposal or a committed operation whose later verification is pending—not an ambiguous mixture.

**Level 8010 — Cross-repository release gate.** The Scale API, capability executor, idempotency store, and evidence layer must share one request identity and a testable commit/receipt contract before claiming end-to-end replay safety.

## Integration decision

Do not wire the existing `IdempotencyStore` into the Scale route as if it were production durability: the inspected implementation is in-memory, and it does not compare canonical payload digests. Do not treat the existing signed receipt as a substitute for a state-bound receipt.

The safe next implementation should first specify a versioned operation envelope and storage contract, then choose one of two honest designs:

- **Preview mode:** compute a proposal without calling `resonant.tick`; return `provisional: true` and a proposal digest. A separate authenticated commit request consumes that proposal under an idempotency key.
- **Commit mode:** perform the state transition through a durable coordinator; return `committed: true`, operation ID, state version, payload digest, and verifiable receipt. Duplicate requests return the same receipt.

For an in-memory process, even a carefully designed local ledger cannot guarantee restart durability. If the authoritative state itself is only in memory, a durable receipt can outlive the state it claims to certify. The implementation must either persist/recover the state and ledger together, or explicitly scope the guarantee to one process lifetime and avoid production durability claims.

## Test and verification plan

The required tests are behavioral and should run against the actual route + executor + storage implementation:

1. Preview request leaves belief, partials, and history unchanged.
2. Commit request advances state exactly once and increments a state version exactly once.
3. Concurrent requests with the same (k,d) produce one transition and the same receipt.
4. Reusing (k) with a different digest is rejected without mutation.
5. Drop the HTTP response after commit; retry with the same key and verify the original receipt/result is returned.
6. Restart the service and verify durable state, key, digest, and receipt reconcile consistently.
7. Verify receipt signature and all bound fields against the persisted committed state.
8. Force evidence-index failure and confirm the commit outcome remains recoverable and never falsely reported as absent.
9. Verify authorization failure and malformed payloads produce no state mutation.
10. Run repository tests and hosted CI; report each separately from source inspection and formula checks.

## Verification ledger

- **Verified by source inspection:** `tick` mutates belief/partials/history; the Scale route calls it before returning `provisional: true`.
- **Verified by source inspection:** `IdempotencyStore` is backed by a Python dictionary and has no visible payload binding/durable persistence in that module.
- **Verified by source inspection:** `Executor.execute` signs a receipt without request identity or payload digest fields and has no visible use of `IdempotencyStore`.
- **Verified by source inspection:** `handle_execute` builds evidence events without request ID or payload digest.
- **Not verified:** any guarantee supplied by infrastructure outside the inspected repository paths.
- **Not run:** route integration tests, concurrency tests, restart tests, receipt-to-state verification, full repository test suite, or live deployment smoke. Hosted Actions on the companion PR previously failed before steps ran; this is neither a test failure nor a pass.

This document records an architectural contract gap; it does not claim to implement a durable transaction protocol. PR remains draft and unmerged.

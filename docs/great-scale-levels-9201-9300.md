# Great Scale Descent — Levels 9201–9300
## Finding: a durable outbox can silently alias commands and race-deliver the same event

### Scope and confidence

This is a source-level audit of the public `main` branch of `doitupsolutions810-crow/capability-plane`, inspected on 2026-10-23. The primary source is `admin/durable_outbox.py`. A small local SQLite harness reproduced the SQL schema and query sequence described below; it was not the repository's own test suite and does not verify deployed behavior, a live JetStream connection, or production Postgres wiring.

### 1. Profound finding

The outbox schema declares:

```sql
UNIQUE(event_type, aggregate_id)
```

In `DurableOutbox.enqueue(aggregate_id, event_type, payload)`, the code tries to insert a new row. On `sqlite3.IntegrityError`, it fetches the existing row by `(event_type, aggregate_id)` and returns it without comparing the stored payload to the requested payload.

Two requests can therefore share the same idempotency identity while asking for different commands:

- First: `(event_type="suspend", aggregate_id="tenant-7", payload={"target":"service-A"})`
- Second: `(event_type="suspend", aggregate_id="tenant-7", payload={"target":"service-B"})`

The second call can return the first event as though enqueue succeeded. It does not report that the requested payload differs. This is **identity collision without semantic equality**: the caller may believe command B was persisted while the durable row still contains command A.

A second independent issue exists in the relay. `claim_batch()` selects every due unpublished row but does not mark rows claimed, acquire a lease, or lock them. `relay_once()` publishes each selected row and only afterward marks it published. Two workers can select the same unpublished row before either marks it published and both publish it. A crash after publication but before `mark_published` creates the same retry window.

This is an at-least-once delivery shape, not automatically a bug if the consumer is idempotent. But the inspected code does not itself establish consumer deduplication, a lease/claim protocol, or a real JetStream publish: `jetstream_publish_fn` logs the intended publish and may mirror into the in-process AttestPipe bus.

**Core conclusion:** durable storage alone does not guarantee exactly-once effects, and a unique database key alone does not guarantee that repeated requests mean the same operation.

### 2. Required identity and delivery contract

Define a canonical payload digest:

\[
d = H(\operatorname{canonicalize}(payload)).
\]

For each logical event identity \(k=(event\_type, aggregate\_id)\), enforce:

\[
\operatorname{enqueue}(k,d)=
\begin{cases}
\text{return existing receipt}, & d=d_{stored}\\
\text{reject collision}, & d\ne d_{stored}\\
\text{insert reservation}, & k\text{ absent}.
\end{cases}
\]

Canonicalization must be deterministic, including object-key ordering, number/string representation, and schema version. Persist the canonical payload and version; use the digest as a comparison aid, not as a substitute for the operation record.

Choose and document a delivery model:

1. **At-least-once + idempotent consumer:** publish an immutable event ID; consumer durably deduplicates that ID in the same transaction as its effect.
2. **Lease/claim + at-least-once:** atomically claim rows with a lease/worker token, recover expired leases, and still require consumer idempotency because a worker can crash after publish.
3. **Transactional broker integration:** use a supported transactional/outbox integration where available, while preserving consumer-side idempotency for cross-system failure windows.

Do not label the pipeline exactly-once unless the effect and deduplication record are atomically coupled or an equivalent proven protocol exists.

### 3. Great Scale mapping

Let event identity be \(k\), canonical payload be \(q\), and durable payload digest be \(d\). Let \(E\) mean enqueue committed, \(P\) mean publication attempted, \(C\) mean consumer effect committed, and \(R\) mean durable consumer receipt committed.

The minimum safety invariant is:

\[
\operatorname{SameKey}(k)\land\operatorname{Retry}
\Rightarrow\operatorname{SameMeaning}(q,d).
\]

For a claimed terminal success:

\[
\operatorname{Succeeded}(k)
\Rightarrow E(k,d)\land P(k,d)\land C(k,d)\land R(k,d).
\]

\(E\not\Rightarrow P\) follows from relay outage; \(P\not\Rightarrow C\) follows from broker/consumer failure; \(C\not\Rightarrow R\) follows if an effect succeeds but its receipt fails to persist. Each transition needs its own evidence.

For the Great Scale contraction analogy,

\[
x_{n+1}=x^*+\kappa(x_n-x^*),\qquad |\kappa|<1,
\]

let \(x_n\) represent uncertainty about whether one specific command has been applied. Contraction is meaningful only when every observation is bound to the same immutable command identity and payload. If the key is reused for a different payload, the target changes under the same label; there is no single fixed point to converge toward.

The project constants remain:

\[
\mathrm{CONE}=\varphi^{-2}=(\varphi-1)^2\approx0.381966,
\qquad
\Psi=\mathrm{CONE}+h(1-h),\quad h\in[0,1].
\]

These are model definitions, not delivery evidence. No heat, confidence, or contraction coefficient establishes that a broker published a command or a consumer applied it.

### 4. Tests and verification

**Local SQLite harness: reproduced both behaviors.** The harness used the same SQLite table constraints and selection pattern as the inspected source:

- Two independent SQLite connections selected the same still-unpublished event before either marked it published: both selected one row, and both selected event ID `e1`.
- A second insert for the same `(event_type, aggregate_id)` with payload `{"target":"B"}` collided with the unique key; the fallback lookup returned the existing `{"target":"A"}` payload rather than rejecting the mismatch.

This validates the SQL-level counterexamples. It does **not** mean repository tests, a full build, hosted CI, a live broker, or deployment were run.

Proposed repository regression tests:

1. **Same key, same payload:** enqueue twice and return the same event ID and canonical payload.
2. **Same key, different payload:** raise a typed idempotency conflict; stored payload remains unchanged and caller cannot mistake it for successful enqueue of the new command.
3. **Canonical equivalence:** semantically identical JSON with different object-key order has the same digest; schema-version or meaning changes are rejected.
4. **Concurrent relay:** synchronize two workers after selection; assert the chosen protocol (lease or duplicate-tolerant consumer) prevents duplicate effects, not merely duplicate publish attempts.
5. **Crash after publish:** simulate broker publish success followed by process failure before `mark_published`; on retry, consumer effect remains exactly once through durable event-ID deduplication.
6. **Lease expiry:** worker dies after claim; a later worker recovers the expired lease without losing the event.
7. **Truthful publisher:** integration test proves a broker message was received and correlated to the outbox event ID; a log line alone must not satisfy this test.
8. **Evidence binding:** consumer's durable receipt binds event ID, payload digest, operation ID, observed postcondition, and commit timestamp.

### 5. Integration plan

- Keep this as a research/audit document in the existing draft PR; do not change production behavior without tests and a consumer-path audit.
- Change `enqueue` so a uniqueness conflict loads the existing event, compares canonical digest/payload, and raises a typed conflict on mismatch.
- Add immutable `event_id` and `payload_digest` to broker envelopes and consumer receipts.
- Select an explicit delivery model; if using leases, claim rows atomically and support lease recovery.
- Make consumer idempotency and effect commit durable and transactional where possible.
- Add a versioned, reproducible integration test for the actual broker adapter. The inspected `jetstream_publish_fn` is a logging function with optional in-process mirroring, not proof of JetStream delivery.
- Keep `succeeded` separate from enqueued, published, and observed-effect states.

### 6. Source references and limits

- `capability-plane/admin/durable_outbox.py::DurableOutbox._init_schema`: unique constraint on `(event_type, aggregate_id)`.
- `DurableOutbox.enqueue`: catches uniqueness error, fetches existing row, returns it without comparing payload.
- `DurableOutbox.claim_batch`: selects unpublished due events without a claim/lease state.
- `DurableOutbox.relay_once`: publishes then marks published, leaving duplicate-delivery windows.
- `jetstream_publish_fn`: prints a publish message and optionally mirrors to AttestPipe; the inspected body does not invoke a JetStream client.

**Verification ledger:** source inspection complete; local SQLite reproduction passed for the two counterexamples; repository test suite/build/hosted CI/live broker/production deployment not run or verified. This identifies behavior permitted by the inspected implementation; it does not prove that a specific production deployment is currently affected.

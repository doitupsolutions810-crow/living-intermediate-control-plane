# Great Scale — Levels 9401–9500
## Profound finding: the “JetStream publisher” is not a JetStream publisher

### Executive result
A fresh read of the public `main` source at `capability-plane/admin/durable_outbox.py` materially sharpens the prior finding:

`jetstream_publish_fn()` logs a line that says `publish`, then optionally calls the in-process `attestpipe.bus.BUS.publish(...)` mirror. The inspected function contains no JetStream client, connection, subject publish API, broker acknowledgement, or acknowledgement validation.

Therefore the name `jetstream_publish_fn` overstates what the inspected implementation proves. Its normal return means only that the callback completed; it does **not** prove that JetStream received the event. Since `relay_once()` marks the event published whenever the callback returns normally, the default callback can mark an event published after only logging it (and possibly attempting an in-process mirror). That can suppress retries without a broker publish.

This is a stronger and more precise conclusion than “at-least-once delivery with duplicate risk”: in the inspected source path, actual broker delivery is not implemented by this callback at all. This is a source-level conclusion, not a claim about any other publisher or deployed wiring elsewhere.

### 1. Evidence from the source
The inspected file has this control flow:

1. `jetstream_publish_fn` prints `[durable-outbox] publish ...`.
2. If `ATTESTPIPE_MIRROR_OUTBOX` is enabled (default `1`), it attempts `BUS.publish` inside a `try/except`.
3. Any mirror exception is printed and swallowed.
4. The callback returns normally.
5. `relay_once` calls `mark_published(ev.id)` after every normal callback return.

Separate source facts in the same file:
- `claim_batch` selects due, unpublished rows but does not atomically reserve or lease them.
- `enqueue` has `UNIQUE(event_type, aggregate_id)`; on an integrity error it returns the existing row without comparing payload meaning.
- The default database is SQLite. The module docstring refers to a Postgres schema for production, but this file alone does not prove that production uses a correctly wired Postgres implementation.

### 2. Correct semantic names
Use names and states that describe evidence rather than intent:

- `log_publish_intent`: log only; never changes delivery state.
- `mirror_to_attestpipe`: optional in-process mirror; its result is not broker acknowledgement.
- `publish_to_jetstream`: must call a real configured JetStream client and validate its acknowledgement.
- `published_at`: set only after the defined primary transport returns a valid acknowledgement correlated to immutable event ID and payload digest.
- `applied_at` / consumer receipt: separate from transport acknowledgement.
- `verified_at`: only after the required postcondition is independently observed and durably recorded.

If no real JetStream adapter is configured, relay must raise a typed `TransportNotConfigured` error and leave the event retryable; it must not report publication success.

### 3. Formal Great Scale contract
Let (O=(id,v,q,d)), with (d=H(\operatorname{Canonicalize}_v(q))). Define:
- (L(O)): intent logged;
- (M(O)): optional local mirror accepted;
- (J(O)): real broker acknowledged the immutable event;
- (A(O)): consumer effect committed;
- (R(O)): durable receipt binds effect to the same ID and digest.

The unsafe implication currently permitted by the inspected callback is:
\[
(L(O)\land (\text{mirror skipped or failed}))\Rightarrow
\text{callback returns normally}\Rightarrow\text{published\_at set}.
\]

The required implication is:
\[
\operatorname{SetPublished}(O)\Rightarrow J(O).
\]
And terminal success requires:
\[
\operatorname{Succeeded}(O)\Rightarrow J(O)\land A(O)\land R(O).
\]

No substitution is valid: (L\not\Rightarrow J), (M\not\Rightarrow J), and (J\not\Rightarrow A).

### 4. Great Scale levels
- **9401 — Intent/transport separation:** a log line is not a publish.
- **9402 — Adapter reality:** a broker adapter must call a real client API.
- **9403 — Acknowledgement gate:** only a validated broker acknowledgement can set `published_at`.
- **9404 — Failure preservation:** missing adapter and mirror errors remain retryable; swallowed errors cannot become success.
- **9405 — Immutable identity:** event ID + canonicalization version + payload digest travel through the envelope.
- **9406 — Collision rejection:** same identity with different payload digest is a typed conflict.
- **9407 — Relay concurrency:** atomic claim/lease or a documented safe concurrency protocol prevents workers from treating the same row as independently claimed.
- **9408 — Consumer idempotency:** duplicate deliveries do not duplicate business effects.
- **9409 — Evidence-bound terminal state:** applied effect and receipt correlate to the same immutable operation.
- **9410 — Deployment truth:** source wiring, unit tests, broker integration, hosted CI, and deployed behavior remain separate claims.

### 5. Mathematical boundary
The project defines
\[
\mathrm{CONE}=\varphi^{-2}\approx0.381966,\qquad
\Psi=\mathrm{CONE}+h(1-h),\quad h\in[0,1].
\]
Since (0\le h(1-h)\le1/4), it follows that
\[
\mathrm{CONE}\le\Psi\le\mathrm{CONE}+\tfrac14.
\]
These are valid mathematical bounds for the model. They do not certify transport success. The system must keep the numeric state and the evidence state orthogonal: a valid (Psi) cannot turn a missing broker acknowledgement into (J(O)).

### 6. Required tests (specifications, not claimed executed)
1. Default callback with no broker client must fail closed; event remains unpublished.
2. A logger-only callback must never advance delivery state.
3. Mirror disabled, mirror succeeds, and mirror throws: none can substitute for broker acknowledgement.
4. Broker publish returns a valid acknowledgement: set published state and persist acknowledgement metadata.
5. Broker timeout after possible acceptance: retry safely; consumer deduplication prevents duplicate effect.
6. Concurrent relay workers: only valid claims proceed, with lease expiry and crash recovery tested.
7. Same `(event_type, aggregate_id)` and changed canonical payload: reject with conflict.
8. Same identity and semantically equivalent canonical payload: return the same durable receipt.
9. Consumer crash between effect and receipt: transaction or recovery protocol resolves ambiguity.
10. Terminal status without correlated consumer receipt: reject.

### 7. Verification ledger
- **Source read:** `capability-plane/admin/durable_outbox.py` fetched from public `main`; the callback and relay control flow were inspected.
- **Source finding:** no actual JetStream publish call or broker acknowledgement is present in the inspected callback.
- **Source finding:** local mirror exceptions are caught; normal callback return still allows `mark_published`.
- **Source finding:** no atomic claim/lease in `claim_batch`; payload is not compared in the uniqueness-conflict fallback.
- **Tests/build:** not run against the repository in this turn.
- **Live broker / production deployment:** not verified.
- **Consumer path:** not fully traced; do not infer that no consumer dedupe exists elsewhere.

### Decision
Do not treat this callback as a production JetStream adapter. The next safe code change is to replace the misleading default with a fail-closed transport interface and to permit `published_at` only after a real, validated broker acknowledgement. Then add unit tests and a broker integration test before changing deployment or promotion status.

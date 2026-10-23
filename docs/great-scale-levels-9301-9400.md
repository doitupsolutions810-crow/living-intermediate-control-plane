# Great Scale Descent — Levels 9301–9400
## Finding: the relay's “published” bit can certify a swallowed mirror failure

### Scope and confidence

Source-level audit of public `main` in `doitupsolutions810-crow/capability-plane`, specifically `admin/durable_outbox.py` and `attestpipe/bus.py`, inspected 2026-10-23. This extends Levels 9201–9300. The claim is about the inspected control flow; actual production configuration, external consumers, and broker deployment were not verified.

### 1. Profound finding

The previous level established that `jetstream_publish_fn` does not call a JetStream client in its inspected body. Deeper tracing shows a second, independent success-accounting gap in the fallback/mirror path:

1. `DurableOutbox.relay_once()` invokes `publish_fn(ev)`; if that function returns normally, it calls `mark_published(ev.id)` and increments its success count.
2. `jetstream_publish_fn()` prints a line labelled `[durable-outbox] publish ...`, then optionally calls `BUS.publish(...)`.
3. `AttestPipeBus.publish()` catches any exception from `_mirror_sqs(payload)`, stores the exception text in the returned payload as `_mirror_error`, and returns normally.
4. The outbox publisher ignores the returned payload. Therefore the relay treats the event as published even when the SQS mirror explicitly failed.
5. There is an even quieter path: if importing `boto3` raises `ImportError`, `_mirror_sqs()` returns silently. No SQS send occurs, but the outbox can still be marked published.

The default mirror configuration is enabled by `ATTESTPIPE_MIRROR_SQS=1`, and the default endpoint is `http://127.0.0.1:4566`. Those defaults do not prove that a queue exists or that a deployed process can reach it.

**The key distinction:** the durable outbox's `published_at` currently means “the Python callback returned without raising,” not “a configured durable transport acknowledged this event.” In this path, a log line and normal function return can be promoted into a durable terminal status without transport evidence. This can strand an event: because `published_at` is set, the relay no longer selects it for retry, even though the configured mirror may never have received it.

This finding is distinct from ordinary at-least-once duplicate delivery. Levels 9201–9300 covered duplicate windows and payload collisions; this level exposes a potential **false-positive delivery acknowledgement / lost-retry window**.

### 2. Mathematical contract

Let:
- (O): outbox row committed;
- (I): publisher callback invoked;
- (A): durable transport accepted the event and returned a valid acknowledgement;
- (D): destination has a durable copy, or a broker receipt proves accepted persistence under the chosen contract;
- (M): outbox row marked published.

The inspected implementation effectively uses:

\[
M \Leftarrow I \land \operatorname{CallbackReturnedNormally}.
\]

But the intended delivery claim requires at least:

\[
M \Rightarrow O \land A,
\]

where (A) must come from the actual configured transport, not from a log statement or a best-effort mirror. If the contract promises broker persistence, define the broker's acknowledgement level precisely.

Counterexample:

\[
I=1,\quad A=0,\quad \operatorname{CallbackReturnedNormally}=1
\quad\Longrightarrow\quad M=1.
\]

Then the relay's retry predicate `published_at IS NULL` excludes the row. The event is now represented as delivered without evidence of transport acceptance.

The Great Scale evidence ordering is:

\[
\text{enqueued} \prec \text{dispatch attempted}
\prec \text{transport acknowledged}
\prec \text{consumer effect observed}
\prec \text{durable receipt committed}.
\]

These states must not be collapsed. A successful callback is evidence only of callback completion; it is not evidence of broker acceptance or consumer effect.

For the contraction analogy,

\[
x_{n+1}=x^*+\kappa(x_n-x^*),\qquad |\kappa|<1,
\]

let (x_n) be uncertainty about delivery of one immutable event. Setting (x_{n+1}=x^*) solely because the callback returned is not a measured contraction step when transport acknowledgement is absent. The update rule is missing its observation.

Project model constants remain:

\[
\mathrm{CONE}=\varphi^{-2}=(\varphi-1)^2\approx0.381966,
\qquad \Psi=\mathrm{CONE}+h(1-h),\quad h\in[0,1].
\]

These constants do not supply delivery evidence; operational assurance requires explicit transport receipts and correlated state transitions.

### 3. Levels 9301–9310

- **9301 — Callback completion is not delivery:** name the evidence actually observed by each layer.
- **9302 — A log line is not an acknowledgement:** logging must never drive a durable success transition.
- **9303 — Best-effort failure must stay visible:** a swallowed mirror exception cannot be treated as publish success.
- **9304 — Missing dependency is a mode, not success:** if SQS mirroring is required, missing `boto3` must fail preflight or fail publication.
- **9305 — Mark-after-ack:** write `published_at` only after the configured transport returns a validated acknowledgement.
- **9306 — Explicit optionality:** if a mirror is optional, do not use its state to assert primary transport delivery.
- **9307 — Durable retry boundary:** a row must remain retryable while required transport acknowledgement is absent or ambiguous.
- **9308 — Acknowledgement identity:** bind the transport receipt to event ID and payload digest.
- **9309 — Unknown is not delivered:** a timeout after a send attempt remains unknown until lookup/reconciliation resolves it.
- **9310 — Consumer completion is separate:** transport acceptance does not prove the consumer applied the command.

### 4. Test and verification ledger

**Behavioral reproduction run in this session:** a small Python harness mirrored the inspected control flow: the bus caught a simulated queue failure and returned a payload with `_mirror_error`; the publisher ignored that return; the outbox callback returned normally; relay count was 1 and the event was marked published. Assertions passed.

This is a control-flow reproduction, not an import/run of the repository modules. The actual source paths were fetched from GitHub and reviewed. The harness does not establish that a live SQS queue or production deployment behaves this way.

Required repository tests:
1. Simulate SQS send failure; assert required-transport mode raises and the outbox row remains unpublished/retryable.
2. Simulate missing `boto3`; assert startup fails when SQS is required, or delivery remains explicitly pending.
3. Return a structured broker acknowledgement containing event ID/message ID; assert `published_at` is written only after acknowledgement validation.
4. Simulate ambiguous timeout after broker acceptance; reconcile by immutable event ID before retry.
5. Test optional mirror failure separately from primary broker success; ensure mirror status cannot overwrite the primary delivery state.
6. Assert log-only publisher implementations are rejected by integration tests for production delivery mode.
7. Run a real integration test against the configured broker emulator or broker and verify message receipt, correlation ID, payload digest, and retry behavior.

**Not run / not verified:** repository test suite, full build, hosted CI, live SQS/JetStream, production Postgres, deployed configuration, or production impact.

### 5. Integration plan

Keep this as an audit document in the existing draft PR; no production source changes are made here.

- Replace ambiguous `jetstream_publish_fn` naming/behavior with explicit transport adapters whose contract states whether they are a real broker publisher, local test mirror, or log-only stub.
- Have transport adapters return a typed acknowledgement, including immutable event ID, payload digest, transport message ID, and acknowledgement level; fail closed when a required transport is unavailable.
- Do not swallow required-transport failures. If the mirror is optional, report its status separately and do not let it determine `published_at`.
- Make `relay_once` mark publication only after validating the required transport acknowledgement. Preserve retryable state on failure/unknown.
- Keep the outbox event ID and canonical payload digest in the transport envelope and consumer receipt.
- Pair this with the prior level's payload-collision rejection and consumer-side durable deduplication. Neither leases nor broker acknowledgements alone prove exactly-once effects.

### 6. Source references

- `capability-plane/admin/durable_outbox.py::DurableOutbox.relay_once`: normal return from `publish_fn` is followed by `mark_published` and increments the count.
- `capability-plane/admin/durable_outbox.py::jetstream_publish_fn`: logs “publish”; invokes `BUS.publish` only when `ATTESTPIPE_MIRROR_OUTBOX` is enabled; ignores its return value; catches exceptions from AttestPipe and logs a skip.
- `capability-plane/attestpipe/bus.py::AttestPipeBus.publish`: catches SQS mirror exceptions, adds `_mirror_error` to the returned payload, and returns normally.
- `capability-plane/attestpipe/bus.py::AttestPipeBus._mirror_sqs`: silently returns if `boto3` cannot be imported; otherwise sends to the configured queue and endpoint.

**Conclusion:** the current code's durable `published_at` state is stronger than the evidence observed in the callback. The fix is not merely “add retries”; it is to define and enforce the transport acknowledgement contract and preserve an explicit unknown/pending state until the required evidence exists.

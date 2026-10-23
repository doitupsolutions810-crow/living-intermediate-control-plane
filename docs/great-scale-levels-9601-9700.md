# Great Scale — Levels 9601–9700
## Profound finding: transport evidence is not bound to the transport named by the state

### Executive result

A cross-file read of `admin/durable_outbox.py` and `attestpipe/bus.py` sharpens the prior artifact-closure and publication-state findings. The relay's state transition is not bound to a successful acknowledgement from a specific primary transport.

In `admin/durable_outbox.py`:

1. `jetstream_publish_fn()` prints a message labelled as a publish attempt.
2. It optionally imports `attestpipe.bus.BUS` and calls `BUS.publish(...)`.
3. Any exception from that optional mirror path is caught and printed.
4. The callback then returns normally.
5. `DurableOutbox.relay_once()` calls `mark_published()` after any normal callback return.

The callback does not call a JetStream client or validate a JetStream acknowledgement. In `attestpipe/bus.py`, the separate optional SQS-compatible mirror can call `client.send_message(...)`, but that is not a JetStream acknowledgement. It can also swallow failures at the bus layer. The two files therefore expose at least three distinct outcomes that the current state transition collapses: a logged attempt, optional side-channel activity, and confirmed primary-transport publication.

This is a static source finding. No repository test suite, broker, or production deployment was executed.

### Evidence model

For an event (O), define:

- (L(O)): a log line says publication was attempted;
- (M(O)): the optional AttestPipe/SQS mirror path was invoked or accepted a message;
- (J(O)): the primary JetStream transport returned a validated acknowledgement;
- (P(O)): the durable outbox records the event as published;
- (A(O)): a consumer committed the intended business effect;
- (R(O)): a durable consumer receipt/deduplication record exists.

The current source permits the transition:

`callback returns normally => P(O)`

But the required contract is:

`P(O) => J(O)`

Neither of these implications is valid without additional implementation evidence:

`L(O) => J(O)`
`M(O) => J(O)`

Even a true (M(O)) cannot imply (J(O)), because the mirror is a different transport path. The end-to-end success condition remains stronger:

`Succeeded(O) => J(O) AND A(O) AND R(O)`

This is a required contract, not a claim that the current source satisfies it.

### Cross-repository consequence

The living-intermediate-control-plane integration must not treat the existence of a bridge, an in-process bus, an SQS mirror, or a successful callback as interchangeable with verified delivery. The integration boundary needs an explicit transport identity and an acknowledgement contract. Otherwise, observability can report “published” while the named primary broker has never accepted the event.

The earlier artifact-closure finding remains separate: the public `capability-plane/main` tree did not contain the direct import targets `admin/outbox.py` and `attestpipe/messages.py`, while the repository note points to an external ZIP/overlay that was not inspected or hash-linked. A reproducible build artifact must be established before runtime conclusions can be certified.

### Great Scale mapping: Levels 9601–9610

- **9601 — Evidence typing:** represent log, mirror result, primary acknowledgement, consumer effect, and receipt as different evidence types.
- **9602 — Transport identity:** every publication result identifies the actual transport and destination that acknowledged it.
- **9603 — State guard:** `published_at` may be set only from a validated primary acknowledgement.
- **9604 — Fail-closed primary path:** missing or misconfigured primary transport raises a typed failure and leaves the event unpublished.
- **9605 — Non-authoritative mirror:** mirror success may be recorded as supplemental telemetry, never substituted for primary delivery.
- **9606 — Error visibility:** preserve mirror errors separately from primary transport outcomes.
- **9607 — Consumer boundary:** broker acknowledgement does not prove the consumer committed its business effect.
- **9608 — Durable receipt:** end-to-end completion requires a durable, idempotent receipt or an equivalent proven protocol.
- **9609 — Artifact provenance:** test and deploy the exact source/overlay artifact with a recorded immutable identity.
- **9610 — Promotion gate:** require executable contract tests and exact-head CI before promotion.

### Mathematics visible in the Great Scale

The existing bounded scalar remains:

`CONE = φ⁻² ≈ 0.381966`

`Ψ = CONE + h(1-h), 0 ≤ h ≤ 1`

Since `0 ≤ h(1-h) ≤ 1/4`:

`0.381966 ≤ Ψ ≤ 0.631966` (approximately).

This scalar is a model invariant only. It cannot certify artifact closure, broker delivery, or consumer completion. Keep the assurance vector explicit:

`G(O) = (S, I, J, A, R)`

where (S) means artifact closure, (I) means importability under the intended environment, and (J,A,R) mean primary acknowledgement, committed consumer effect, and durable receipt. A scalar score must not erase a failed required coordinate: if any required coordinate is false or unknown, the operation is not certified end-to-end.

### Verification ledger

- **Source read:** `admin/durable_outbox.py` fetched from public `main`; callback and relay transition inspected.
- **Source read:** `attestpipe/bus.py` fetched from public `main`; SQS-compatible send path and exception handling inspected.
- **Static conclusion:** callback normal return is sufficient for `mark_published`; no JetStream client/ack validation appears in the fetched callback.
- **Runtime import test:** not run.
- **Unit/contract tests:** not run.
- **Live JetStream/SQS test:** not run.
- **Release ZIP / overlay:** not inspected or linked to the Git tree by hash.
- **Consumer completion:** not traced end-to-end.
- **CI:** do not infer a pass from this document; check the exact current PR head and its checks independently.

### Remediation order

1. Identify the authoritative source artifact (Git tree or release ZIP) and record its immutable digest.
2. Restore or declare the missing direct-import modules and add clean-environment import smoke tests.
3. Replace the log-only JetStream-labelled callback with a real primary transport adapter.
4. Return a typed publish result containing transport identity and validated acknowledgement metadata.
5. Permit `mark_published` only for the accepted primary acknowledgement; preserve failure/retry state otherwise.
6. Record side-channel outcomes independently.
7. Add tests for primary transport absent, primary publish rejected, mirror fails, mirror succeeds while primary is absent, duplicate relay workers, payload conflict, and consumer redelivery.
8. Run those tests against the exact release artifact and require exact-head CI before changing the integration PR from draft.

### Decision

The deepest actionable issue is **semantic aliasing of delivery evidence**: the implementation names a callback “JetStream” while its visible behavior is logging plus an optional mirror, and the durable state machine interprets callback return as publication. Repair the evidence contract before relying on the published state in downstream control-plane logic.

# Great Scale — Levels 7901–8000: replay safety is part of the state-transition contract

## Profound finding

A deeper cross-repository audit exposed a boundary between a numerically valid transition and an operationally safe transition.

In `living-intermediate-control-plane/platform/src/server.mjs`, `POST /api/v1/scale/step` calls `resonant.tick(nextBelief)` and returns a new frame. The route is behind the existing POST authentication guard, but the inspected handler does not require an idempotency key, bind a request identifier to a payload digest, persist a replay record, or return a verifiable execution receipt.

The companion `capability-authority` repository states a stronger operational contract: one immutable provider idempotency key per control-plane request, reconcile-before-retry when a timeout leaves the outcome unknown, and a verifiable receipt for each issued/executed act.

These are different guarantees. Authentication answers **who may request a transition**. Numerical validation answers **whether the requested values are in-domain**. Neither answers **whether a retry repeats a state-changing operation**.

A client can lose the response after the server has advanced its in-memory lattice and then retry. Without a durable idempotency/reconciliation contract, the client cannot distinguish “the first operation committed but the response was lost” from “the first operation never happened.” If the omitted belief defaults to the live state, a retry can compute from a different starting state. The source audit establishes the missing contract in this handler; it does not establish that every deployment or caller currently retries this way.

## Formal model

Let the live state be (b_n\in[0,1]), and let a step operator be (T(b_n,u)), where (u) is the request input.

A normal state transition is:

\[
b_{n+1}=T(b_n,u).
\]

A transport retry is safe only if it replays the same logical operation, not blindly applies a second transition:

\[
\operatorname{execute}(k,u)=
\begin{cases}
\operatorname{commit}(T(b_n,u),r), & k\text{ unseen and payload valid},\\
r, & k\text{ already committed with the same payload},\\
\operatorname{reject}, & k\text{ reused with a different payload}.
\end{cases}
\]

Here (k) is a stable idempotency key, the payload digest binds the key to (u), and (r) is a durable receipt/result. If the outcome is unknown after timeout, the caller must reconcile by (k) before retrying. The key ledger and result must be durable across process restart and safe under concurrent duplicate requests; an in-memory cache alone would not satisfy this contract.

This is an operational correctness property, not a new physical law. The heat bound (S(b)=b(1-b)\in[0,1/4]) cannot prove replay safety.

## Required integration before claiming end-to-end safety

1. Define a request envelope with a caller-generated stable request ID/idempotency key and a canonical payload digest.
2. Persist the key, digest, transition result, and receipt atomically with the state transition, or use an existing capability-authority execution protocol that guarantees this binding.
3. Same key + same digest returns the original receipt/result without another `resonant.tick`; same key + different digest fails closed.
4. On ambiguous timeout, reconcile by key; do not generate a new key and blindly retry.
5. Add concurrent duplicate, lost-response/replay, process-restart, key/payload mismatch, and receipt-verification tests.
6. Do not call this endpoint end-to-end idempotent until those tests execute against the real adapter and durable store.

No receipt or capability-authority adapter is added by this document. That would require a concrete API contract and durable transaction boundary, not a cosmetic response field.

## Great Scale mapping

**Level 7901 — Authorization is not replay safety.** Authentication and input validation do not make a state-changing request idempotent.

**Level 7902 — Transition semantics.** A stateful operation is defined by both its numerical map and its commit/replay behavior.

**Level 7903 — Request identity.** A stable key names one logical operation; a payload digest prevents key reuse for different operations.

**Level 7904 — At-most-once effect.** A duplicate committed key must return the prior result rather than execute another state transition.

**Level 7905 — Durable outcome.** The idempotency record and result survive process restart and are concurrency-safe.

**Level 7906 — Unknown-outcome reconciliation.** A timeout is not evidence of failure; query the existing request identity before retrying.

**Level 7907 — Evidence binding.** A receipt must bind request identity, payload digest, resulting state/version, and outcome; a success-shaped JSON response alone is not an attestation.

**Level 7908 — Cross-plane contract.** Great Scale supplies model semantics, the control plane performs the transition, and capability authority must supply or verify the execution/idempotency evidence. The boundaries must be explicit.

**Level 7909 — Verification hierarchy.** Unit tests of the formula, HTTP tests of the route, concurrent replay tests, durable-store restart tests, receipt verification, hosted CI, and live deployment smoke are separate evidence levels.

**Level 7910 — Release gate.** Until the durable replay/receipt contract exists and is tested, the endpoint is authenticated and numerically guarded but must not be represented as end-to-end replay-safe.

## Verification ledger

- Source audit: confirmed the handler calls `resonant.tick(nextBelief)` and has no visible idempotency-key/receipt handling in that route.
- Cross-repository contract: capability-authority README explicitly requires immutable idempotency, reconcile-before-retry, and verifiable receipts.
- Mathematical reasoning: the distinction between (T(b,u)) and a keyed commit/replay protocol follows from the stateful operation model above.
- Not run: repository test suite, concurrent replay test, restart/durability test, live HTTP smoke, capability-authority adapter integration.
- Existing hosted CI for the integration PR failed before steps ran (runner ID 0 / zero steps); this is not a test assertion failure and not a pass.

Provisional. No merge or deployment claim.

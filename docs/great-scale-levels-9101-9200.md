# Great Scale Descent — Levels 9101–9200
## Finding: outcome labels are not evidence; terminal states need proof obligations

**Scope:** source-level audit of `doitupsolutions810-crow/capability-authority` and its relationship to the draft control-plane integration. This is not a live-cluster test. The prior Levels 8801–9000 already document process-local lifecycle state, missing request/provider correlation, and a lab-mode Kubernetes adapter that can be classified as success.

## 1. New synthesis

The cross-repository failure pattern is not merely “a missing provider call.” It is a **state-transition soundness gap**: downstream code can promote a weakly evidenced state into a stronger claim.

The documented examples form a chain:
- `planned` describes an intention.
- `applied-lab` describes a lab-mode result.
- `succeeded` is a terminal reconciliation label.
- `outcome: ok` is placed into a locally generated, signed receipt.
- evidence publication may fail without forcing the originating operation to fail.
- the execute path does not visibly carry a stable request ID through provider dispatch and reconciliation.

These labels are not logically equivalent. A signature authenticates the receipt bytes under a key; it does not upgrade the receipt's underlying evidence. A classifier that maps `applied-lab` to `succeeded` can therefore produce a validly signed, semantically overclaimed record.

**Confidence boundary:** these are source-level observations from the inspected modules and prior documented paths. This does not prove that a deployed environment has no additional guard, nor that a production resource was actually affected.

## 2. Mathematical contract

Let an operation have a lifecycle state (s) and an evidence set (E). Define an evidence ordering:

[
E_0 preceq E_1 preceq E_2 preceq E_3 preceq E_4
]

where:
- (E_0): request accepted;
- (E_1): policy authorization verified;
- (E_2): provider dispatch acknowledged;
- (E_3): provider outcome independently observed;
- (E_4): outcome and correlation record durably committed.

These are not numeric scores; the ordering means each stronger claim has additional proof obligations. A state transition is sound only if its evidence preconditions hold:

[
operatorname{Claim}(s_i) Rightarrow operatorname{EvidenceAtLeast}(E_i)
]

In particular,

[
operatorname{planned}
otRightarrowoperatorname{succeeded},
qquad
operatorname{signedReceipt}
otRightarrowoperatorname{providerEffect},
qquad
operatorname{providerEffect}
otRightarrowoperatorname{durableLedgerCommit}.
]

A safe terminal success requires, at minimum,

[
operatorname{Succeeded}(q)
Rightarrow
operatorname{Authorized}(q)
land operatorname{Correlated}(q)
land operatorname{ProviderConfirmed}(q)
land operatorname{DurablyRecorded}(q).
]

If a system deliberately offers a weaker assurance mode, it must expose a weaker terminal label such as `planned`, `simulated`, `dispatch-accepted`, or `outcome-unknown`; it must not reuse `succeeded`.

## 3. Great Scale mapping — Levels 9101–9110

- **9101 — A state label is a claim:** define exactly what evidence each status asserts.
- **9102 — Claims have proof obligations:** terminal states require evidence from the corresponding boundary.
- **9103 — No semantic promotion:** a planner result cannot be promoted to provider success by a generic classifier.
- **9104 — Signatures preserve bytes, not truth:** cryptographic integrity is separate from outcome truth.
- **9105 — Correlation is mandatory:** stable request ID and canonical request digest survive issue → execute → provider → receipt → reconciliation.
- **9106 — Unknown stays unknown:** timeout or missing provider evidence is not success and not automatically failure; reconcile before retry.
- **9107 — Durable success is atomic:** provider idempotency and durable ledger semantics must prevent duplicate effects across retries.
- **9108 — Evidence failure is policy:** if durable audit is a required guarantee, a failed evidence commit must block terminal success or leave a recoverable pending state.
- **9109 — Simulation is a distinct mode:** test/lab adapters must return explicit non-production states that cannot satisfy production success predicates.
- **9110 — Independent verification:** terminal status should be checked against provider query/result evidence, not inferred from the same local code that initiated the action.

## 4. Falsifiable test plan (not run in this step)

1. Feed `planned` and `applied-lab` into reconciliation; assert neither becomes terminal `succeeded`.
2. Feed `ok` without provider correlation/outcome evidence; assert the result is pending or rejected under the production assurance policy.
3. Force evidence-store failure; assert the API cannot report durable success when durable evidence is mandatory.
4. Submit the same idempotency key and identical digest concurrently; assert one effect and one canonical result.
5. Reuse the key with a different method/resource/body digest; assert rejection before dispatch.
6. Simulate timeout after provider acceptance; verify reconciliation queries the same provider idempotency key before any retry.
7. Verify a receipt signature independently, then separately verify its referenced provider result and durable ledger entry.
8. Run the same scenario in lab and production modes; assert lab results are never accepted as production actuation evidence.
9. Restart and route reconciliation to another replica; assert request identity and state survive if the API promises durability.
10. Record exact commit SHA, command, exit code, and runner evidence for every passing test.

## 5. Verification ledger

- **Source-derived:** prior inspected source paths show a plan/lab adapter state, a classifier mapping `applied-lab` to success, a local receipt with `outcome: ok`, and a lifecycle identity/correlation gap.
- **Mathematics:** the implication hierarchy and evidence ordering above are a proposed software assurance contract, not a physical law.
- **Tests run now:** none.
- **Build/deployment:** not run.
- **Runtime impact:** not established.
- **Integration:** document-only; no runtime source changed.
- **Next implementation step:** introduce typed lifecycle states and proof-bearing result objects; require correlation ID, provider evidence, and durable commit before production terminal success; then add regression tests at classifier, adapter, handler, and end-to-end layers.

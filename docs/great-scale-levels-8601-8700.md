# Great Scale descent: Levels 8601–8700

## Profound finding: the grant boundary authenticates the requester-shaped input, not the requested power

**Status:** source-level authorization-policy gap; not demonstrated against a live deployment.

### Repository evidence

Inspected doitupsolutions810-crow/capability-authority@main:

- plane_service/server.py::handle_issue takes rights from the request body, normalizes constraints to a dictionary, derives a TTL, and passes caller, rights, constraints, and TTL to policy.authorize(...). If that call returns, the same caller-supplied rights and constraints are passed to core.issue(...) and the resulting capability is signed.
- plane_service/policy.py::PolicyEngine.authorize checks only that the caller string begins with one of the configured prefixes (spiffe://prod/agent/ or spiffe://prod/broker/ by default) and that TTL does not exceed max_ttl. It does not inspect requested right type, resource, method, or constraint semantics.
- plane_service/core.py::verify grants a match when type and resource equal the required action; it does not compare method. Thus even a method-specific grant is evaluated through a weaker projection.
- plane_service/executor.py uses core.verify and reads only the rate_limit constraint in the inspected execution path. No general evaluator for other constraints is visible in these inspected files.

This is stronger than any one earlier predicate mismatch: the grant decision does not visibly authorize the requested privilege, and the downstream decision discards part of the privilege tuple. A trusted caller prefix is not a resource/method policy.

### Concrete source-level trace

For a caller string that passes the configured prefix check, handle_issue forwards the supplied rights to the signed capability. In the inspected code, the policy decision is not conditioned on whether a requested resource or method is allowed. Separately, a right shaped like {type: database, resource: records/42, method: read} can satisfy verify for a required right with the same type/resource but method: delete because method is not compared.

This establishes a source-level gap in the inspected authorization contract. It does not establish that an external gateway, deployment policy, or uninspected layer does not impose additional controls; those were not verified.

## Mathematical contract

Let a requested grant be r=(t,x,m), with type t, resource x, and method m. Let I be the verified issuer principal and P(I,r,c) be the policy decision for constraints c.

The intended issuance contract is:

\[
\operatorname{Issue}(I,r,c)
\Rightarrow
\operatorname{VerifiedPrincipal}(I)
\land \operatorname{PolicyAllows}(I,r,c)
\land \operatorname{BoundsValid}(r,c).
\]

The inspected policy is closer to:

\[
P_{\text{code}}(I,r,c,\tau)
=
\operatorname{PrefixAllowed}(I)
\land (\tau \leq \tau_{\max}).
\]

The requested grant r and most of c do not participate in that predicate. On verification, the effective right comparison is a projection:

\[
\pi(t,x,m)=(t,x),\qquad
\pi(r_{\text{cap}})=\pi(r_{\text{required}}).
\]

Projection loses the method distinction. Consequently, neither a successful policy check nor a successful signature check alone proves least privilege.

A complete acceptance invariant should bind authority, identity, exact right, and enforced constraints:

\[
\operatorname{Accept}(q)
\Rightarrow
\operatorname{ValidSignature}(q)
\land \operatorname{VerifiedCaller}(q)
\land \operatorname{PolicyAllows}(I,r,c)
\land (r_{\rm granted}\succeq r_{\rm requested})
\land \operatorname{ConstraintsHold}(c,\text{context}).
\]

Here \(\succeq\) must be a documented, explicit right-coverage relation; it must not silently erase method or other security-relevant fields.

## Great Scale mapping

### Levels 8601–8610 — authority is about the grant
1. Caller identity and requested privilege are separate inputs to authorization.
2. A caller allowlist is not an action/resource allowlist.
3. The policy decision must inspect the complete requested right.
4. Empty, malformed, duplicate, or unknown rights must be rejected explicitly.
5. Methods must be validated against a closed vocabulary or a typed schema.
6. Resource scopes must be canonicalized before policy matching.
7. Wildcard semantics must be explicit and narrowly bounded.
8. Constraints must have defined meanings rather than being accepted as opaque metadata.
9. Issuance and verification must use the same versioned right semantics.
10. Unknown policy state must fail closed.

### Levels 8611–8620 — exact attenuation and enforcement
11. Define right coverage over every security-relevant field.
12. Attenuation may only reduce authority under that coverage relation.
13. Verification must compare method when method is part of the grant.
14. Unknown fields must not be silently dropped from signed authorization semantics.
15. A delegated capability must not gain rights through normalization or defaulting.
16. Constraint inheritance and narrowing rules must be explicit.
17. Expiry, audience, trust domain, policy version, and delegation depth remain mandatory independent checks.
18. Tests must prove a read grant cannot satisfy delete, write, admin, or execute requests.
19. Tests must prove unauthorized resources cannot be granted by an otherwise allowed principal.
20. The policy decision should return a structured reason code without leaking sensitive details.

### Levels 8621–8630 — constraints as executable predicates
21. Enumerate supported constraints and reject unsupported ones.
22. Enforce each constraint at the point where its truth can be established.
23. Do not treat a stored constraint as proof that it was evaluated.
24. Define rate-limit key, scope, window, and persistence semantics.
25. Reject invalid rate-limit values instead of coercing them to defaults.
26. Bind environmental constraints to trusted server context, not caller assertions.
27. Bind request and payload identity to authorization decisions where relevant.
28. Version policy evaluation so a signed capability's semantics are reproducible.
29. Emit an auditable policy-decision record bound to capability ID and exact grant digest.
30. Separate policy feasibility from evidence that the requested action occurred.

### Levels 8631–8640 — Great Scale invariant
31. The model state must be in-domain before evaluating its authorization mapping.
32. Let S(h)=h(1-h), with 0 ≤ S(h) ≤ 1/4 only when h is in [0,1].
33. Numerical validity does not imply permission validity.
34. Permission validity does not imply an external effect occurred.
35. A signed artifact proves integrity under a key, not that its contents were policy-approved.
36. A policy approval proves a decision, not that runtime enforcement obeyed it.
37. Exact rights are the operational domain boundary of a capability.
38. Constraint evaluation is a precondition, not decorative metadata.
39. Every implication must state its premises and enforcement point.
40. End-to-end claims require evidence from issuance through the actual effect.

### Levels 8641–8650 — adversarial regression matrix
41. Allowed caller + forbidden resource must be denied at issuance.
42. Allowed caller + forbidden method must be denied at issuance.
43. Read capability + delete request must fail verification and execution.
44. Missing method, unknown method, malformed right, and empty rights must follow explicit policy.
45. Caller-supplied constraint names must not create new policy behavior.
46. Unsupported constraint must be rejected or explicitly marked non-authoritative.
47. Oversized and negative TTL values must be rejected before signing.
48. Same capability under altered required-method input must not widen authority.
49. Delegated rights must be a subset under the exact coverage relation.
50. Tests must run against the public handler path, not only the pure helper.

### Levels 8651–8660 — trust and evidence binding
51. Resolve the caller from verified transport/workload identity at the enforcement boundary.
52. Never treat a body field as proof of caller identity.
53. Bind policy version and exact grant digest into an auditable issuance event.
54. Record the actual execution adapter, target, and provider result in the receipt.
55. Distinguish authorized, dispatched, committed, and reconciled outcomes.
56. A receipt's ok field must be derived from observed outcome, not merely from passing checks.
57. Evidence-store failure policy must match the promised assurance level.
58. Replay protection must bind request ID to canonical payload digest.
59. Rotation must preserve only explicitly trusted signing/verification keys.
60. The production release gate must cover the entire chain.

### Levels 8661–8700 — proof obligations and release gate
61. Specify a machine-readable policy schema for rights and constraints.
62. Implement a single canonical rights validator shared by issue, attenuate, verify, and execute.
63. Keep grant evaluation and request identity resolution as distinct checks.
64. Use exact tuple/typed-object comparison for every security-relevant right field.
65. Define wildcard scope and forbid accidental wildcard expansion.
66. Validate TTL as finite, positive, and within both policy and protocol limits.
67. Add property tests: attenuating a capability can never increase its accepted request set.
68. Add metamorphic tests: changing only method from read to delete must change acceptance when method is security-relevant.
69. Add handler tests proving forbidden grants never receive valid signatures.
70. Add end-to-end tests through the actual execution adapter.
71. Verify test behavior with an independent reference policy evaluator.
72. Verify multi-replica policy-version and key-set consistency.
73. Record the exact commit, test command, exit status, and CI runner result.
74. Treat skipped, queued, rate-limited, or zero-step workflows as unverified—not pass.
75. Keep source audit, unit tests, integration tests, hosted CI, and live deployment as separate evidence classes.
76. Require a security review of any policy schema or right-coverage change.
77. Do not add runtime behavior until tests capture the intended compatibility contract.
78. Do not mark a capability as production-safe based on signature validity alone.
79. Do not claim constraints are enforced until each has an executable check and negative test.
80. Release only when issuance, exact-right verification, constraint enforcement, dispatch, and receipt semantics are jointly verified.

## Recommended remediation order

1. Define the canonical schema for a right, including whether method is mandatory and how resource scope works.
2. Make PolicyEngine.authorize evaluate each requested right against explicit policy, not only caller prefix and TTL.
3. Reject unsupported constraints and enforce every accepted constraint at a defined runtime boundary.
4. Make core.verify compare all security-relevant right fields using the same coverage relation as attenuation.
5. Validate TTL as a positive bounded integer before issuance; do not rely on min(...) alone.
6. Add adversarial tests at helper, HTTP handler, and executor levels before changing production code.
7. Tie the eventual execution receipt to the request ID, grant digest, actual adapter outcome, and durable reconciliation record.

## Verification ledger

- Sources read: plane_service/policy.py, plane_service/bounds.py, plane_service/core.py, plane_service/server.py, and plane_service/executor.py on the default branch of capability-authority.
- Source evidence: PolicyEngine.authorize checks caller prefix and upper TTL only; handle_issue forwards caller-supplied rights/constraints to issuance; core.verify compares type/resource but not method; executor reads rate_limit in the inspected path.
- Finding class: source-level policy/enforcement gap.
- Exploitability: not established; gateway/deployment controls and full runtime topology were not inspected.
- Tests run: none in this step.
- Build/run/deployment: not run. No live behavior is claimed.
- Integration: documentation-only; no runtime code or tests changed.
- Release posture: keep the integration PR draft and unmerged until policy semantics and adversarial tests are implemented and executed.

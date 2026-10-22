# Great Scale — Levels 8201–8300: attenuation is not enforcement

## Profound finding

A deeper read of `capability-authority/plane_service/core.py` reveals a concrete authorization mismatch: `attenuate()` treats a right as the tuple `(type, resource, method)`, but `verify()` authorizes by matching only `(type, resource)`. The method dimension is present in the capability model and used when preventing delegation amplification, yet it is ignored at the final authorization check.

If a capability contains a right such as `{"type":"document","resource":"invoice/42","method":"read"}`, then a required action with the same type and resource but `method:"delete"` satisfies the inspected `verify()` predicate. This is a source-level counterexample derived directly from the function logic; no repository test suite was run in this pass.

The key finding is not merely “method validation missing.” It is a mismatch between the equivalence relation used for attenuation and the one used for authorization: the system preserves a restriction during delegation that it does not enforce during use.

## Source chain

- `plane_service/core.py::attenuate` forms old rights as `(type, resource, method)` and rejects any new right tuple absent from the parent set.
- `plane_service/core.py::verify` loops through rights and returns true when `type` and `resource` match; it does not compare `method`.
- `plane_service/server.py::handle_execute` passes the caller-supplied `required` object to `executor.execute`, which calls `verify(cap, required, caller)`.
- `plane_service/server.py::handle_verify` uses the same core `verify` function, so the same mismatch affects both the verification endpoint and execution authorization path.
- `plane_service/executor.py` uses `verify` as the authorization gate before producing its success response.
- The README's hard rule that agents never mint admin power is compatible with strict attenuation, but strict attenuation alone cannot guarantee least privilege if verification ignores a field used to define a right.

This establishes a bug in the inspected default-branch source. It does not establish whether other deployment layers compensate for the method omission.

## Mathematics: two relations disagree

Let a right be (r=(t,s,m)), where (t) is type, (s) is resource, and (m) is method.

Attenuation uses exact tuple membership:
\[
r_{child}\in R_{parent}\iff
(t_c,s_c,m_c)=(t_p,s_p,m_p).
\]

Authorization currently behaves as a projection:
\[
\operatorname{allow}(R,q)=
\exists r\in R:
(r.t=q.t)\land(r.s=q.s).
\]

The projection (pi(t,s,m)=(t,s)) discards the method. Therefore:
\[
(t,s,\text{read})\ne(t,s,\text{delete})
\quad\text{but}\quad
\pi(t,s,\text{read})=\pi(t,s,\text{delete}).
\]

So a restriction can be preserved by attenuation and then lost at verification. This violates the desired least-privilege monotonicity: reducing the set of permitted methods must reduce the set of accepted requests.

## Great Scale mapping

**Level 8201 — One canonical right relation.** Issue, attenuate, verify, execute, audit, and test must agree on the complete authorization tuple.

**Level 8202 — Attenuation is only as strong as use-time enforcement.** A narrower child capability is not safer if the verifier projects away the narrowed dimension.

**Level 8203 — Method is security-relevant data.** If `method` is supported in rights, verification must compare it. If methods are intentionally irrelevant for some action types, that exception must be explicit and type-scoped.

**Level 8204 — Missing is not wildcard by accident.** Define whether absent method means deny, a documented wildcard, or a legacy compatibility mode. Never let a missing value silently broaden privilege.

**Level 8205 — Monotonicity invariant.** For child rights (R_c\subseteq R_p), every request authorized by (R_c) must also be authorized by (R_p); conversely, removing a method from a capability must not leave that method authorized.

**Level 8206 — One predicate across all entry points.** `/verify` and `/execute` must use the same complete authorization predicate, not independent partial interpretations.

**Level 8207 — Test adversarial pairs.** For equal type/resource and unequal method, read must not authorize delete, list must not authorize write, and a missing method must follow an explicit policy.

**Level 8208 — Receipt binds the exact authorized request.** The receipt and evidence must record the canonical method as well as type/resource; otherwise forensic review cannot establish which operation was checked.

**Level 8209 — Fix without semantic drift.** Normalize the action/right schema once, reject malformed rights, and compare canonical fields in a single pure predicate.

**Level 8210 — Release gate.** No production claim of least privilege until method mismatch tests pass in core, HTTP verify, and execute paths, plus the existing suite.

## Recommended minimal code fix

In `verify()`, require the method to match when the schema defines it. A safe default is exact matching for all method-bearing rights and requests; if compatibility requires wildcard behavior, encode an explicit wildcard token and test it rather than treating absence as implicit permission.

Conceptually:
\[
\operatorname{allow}(R,q)=\exists r\in R:
t_r=t_q\land s_r=s_q\land m_r=m_q.
\]

Before changing runtime behavior, inspect all existing right producers and callers to learn whether `method` is mandatory or whether a deliberate wildcard convention exists. Add tests for exact match, method mismatch, missing method on either side, attenuation, and parity between `handle_verify` and `handle_execute`. Then run `bash scripts/run_ci_local.sh` and report its real output.

## Test / verify ledger

- **Verified by source inspection:** `attenuate()` compares type/resource/method; `verify()` compares only type/resource.
- **Derived counterexample:** a right for `document:invoice/42:read` can satisfy a request for `document:invoice/42:delete` if caller, expiry, and all other checks pass.
- **Not run:** a Python executable regression test, unit suite, HTTP integration test, or local CI script.
- **No runtime code changed in this document-only commit.** This document records the security contract and proposed minimal fix; it does not claim the vulnerability is already fixed.

This is a capability semantics defect: the system defines privilege with three coordinates, but enforces only two.

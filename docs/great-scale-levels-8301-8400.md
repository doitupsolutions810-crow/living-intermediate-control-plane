# Great Scale — Levels 8301–8400: an audience claim is not caller authentication

## Profound finding

The next descent identifies a caller-identity gap in the capability HTTP path. Capability issuance uses `bind_issue_request()` to resolve the issuer's workload identity, but `handle_verify()` and `handle_execute()` do not resolve or authenticate the requester's workload identity. Instead, both accept `caller` from the JSON body and default it to the capability's own `audience`.

In `handle_verify`:
`caller = body.get("caller") or cap.get("audience") or ""`

In `handle_execute`, the same pattern is used. The core verifier then checks whether the supplied string equals the capability audience (or the wildcard `*`). If the caller field is omitted, the server supplies the expected audience itself. If a caller field is supplied, the code checks the asserted string, not a caller identity established in that handler.

This means the audience comparison is not, by itself, proof that the actual caller is the named workload. A deployment-level authenticated gateway, mTLS identity injection, or other outer control could provide that proof, but such a control is not demonstrated by these handler paths. The finding is about the inspected service contract, not a claim that every deployment is exploitable.

## Source chain

- `plane_service/server.py::handle_issue` calls `bind_issue_request`, which resolves a workload identity and replaces the body caller with the resolved identity.
- `plane_service/server.py::handle_verify` accepts the body, checks the capability signature and bounds, then chooses the caller from the body or falls back to `cap.audience`.
- `plane_service/server.py::handle_execute` uses the same caller-selection pattern and passes the asserted caller into `executor.execute`.
- `plane_service/executor.py::Executor.execute` validates the capability signature and bounds and calls `verify(cap, required, caller)`; it does not fetch the requester's SPIFFE identity.
- `plane_service/core.py::verify` compares the supplied caller string against the capability audience, allowing exact audience or `*`.
- The server is an HTTP handler; this code path does not itself show transport-level client certificate validation or identity binding. Such enforcement may exist outside the repository and must be evidenced separately.

## Mathematics: identity assertion versus identity proof

Let (a) be the capability audience, (c) the caller string supplied in the request body, and (I(req)) the authenticated identity of the incoming request.

The current core predicate checks:
\[
\operatorname{audienceMatch}(a,c)=(c=a)\lor(a=*).
\]

The security property required for workload-bound capabilities is:
\[
\operatorname{audienceMatch}(a,I(req))=\mathrm{true},
\]
where (I(req)) comes from an authenticated channel or trusted identity provider, not from the same untrusted request body being authorized.

When the caller is omitted, the handler sets (c:=a), so:
\[
c=a\Rightarrow\operatorname{audienceMatch}(a,c)=\mathrm{true}
\]
by construction. That proves the chosen string matches itself; it does not prove who sent the request.

## Great Scale mapping

**Level 8301 — Audience is a claim, identity is a fact established by a trust boundary.** Keep the distinction explicit in code and response metadata.

**Level 8302 — Never default the principal to the authorization target.** A missing caller must not be filled with the capability's own audience in a security-sensitive verification path.

**Level 8303 — Bind the transport principal.** Obtain caller identity from authenticated mTLS/SPIFFE or a trusted gateway assertion that is cryptographically and operationally bound to the request.

**Level 8304 — Identity provenance is first-class.** Record whether identity came from Workload API, mTLS, trusted proxy, environment fallback, or a client-supplied assertion; fail closed in production when provenance is insufficient.

**Level 8305 — Issue and use must share the same identity semantics.** If issuance binds the audience to workload identity, verification and execution must compare it to the authenticated request principal.

**Level 8306 — Caller override is a security policy, not a convenience.** Any override must be explicit, restricted to trusted environments, and impossible to activate by an untrusted request alone.

**Level 8307 — Test spoofing and omission.** A body that claims the authorized audience from a different authenticated principal must be rejected; omission must not silently become the target audience.

**Level 8308 — Wildcard audience requires separate governance.** If `*` is supported, constrain which issuers may create it and which actions/resources it can cover.

**Level 8309 — Receipt records both asserted and authenticated principals.** Bind the actual authenticated principal and its provenance into execution receipts; never record only the caller-provided string.

**Level 8310 — Release gate.** Prove identity binding at issue, verify, and execute endpoints, including negative tests for forged caller fields and absent credentials.

## Integration plan

1. Define the trusted request-principal contract: direct SPIFFE/mTLS, or a gateway-signed identity assertion with explicit trust configuration.
2. Resolve the principal in the HTTP boundary for `/verify` and `/execute`; do not trust `body.caller` as identity.
3. Reject missing identity in production. Development fallback must be unmistakably marked and unable to authorize production capabilities.
4. Compare the capability audience to the authenticated principal in the shared verifier.
5. Decide explicitly whether wildcard audience is allowed and constrain it by policy.
6. Include identity provenance in receipts and evidence.
7. Add tests: no credential, mismatched credential/body caller, forged audience claim, valid authenticated caller, wildcard policy, and parity between verify and execute.
8. Run the capability-authority local CI script and hosted checks; separately verify any reverse proxy/mTLS configuration if the trust boundary is outside this repository.

## Test / verify ledger

- **Verified by source inspection:** issue calls the SPIFFE binding layer; verify and execute use body caller or capability audience fallback.
- **Verified by source inspection:** Executor calls the core verifier but does not fetch the requester's workload identity.
- **Derived security consequence:** the audience comparison alone cannot prove the actual requester matches the audience.
- **Not established:** whether a deployment gateway or transport layer supplies and enforces an authenticated principal before this handler.
- **Not run:** executable spoofing regression tests, HTTP integration tests, local CI, or deployment-boundary verification.
- **No runtime code changed in this document-only integration.**

The underlying principle is that identity must enter the authorization predicate through a trusted channel. A client cannot prove its identity merely by naming itself.

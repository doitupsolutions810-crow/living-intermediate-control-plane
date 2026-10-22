# Great Scale Levels 8401–8500: Identity Provenance Must Be Evidence, Not a Label

## Finding

**Identity provenance is fail-open when production enforcement treats source labels as proof.**

Repository inspected: `doitupsolutions810-crow/capability-authority`, branch `main`.

Relevant files:
- `plane_service/spiffe_identity.py`
- `plane_service/spiffe_binding.py`
- `plane_service/server.py`

### Source observations

1. `fetch_workload_identity()` prefers a Workload API X.509-SVID when it can successfully fetch one.
2. If the Workload API path does not yield an identity, the resolver can return an identity from `PLANE_SPIFFE_ID` / `SPIFFE_ID` with source `"env"`.
3. If no environment identity is configured, it can synthesize `spiffe://{trust_domain}/agent/dev` with source `"fallback"` when no socket is configured, or source `"socket"` when a configured socket is reachable but the SVID fetch failed.
4. `resolve_issue_identity()` sets its `required` mode when `SPIFFE_REQUIRED=1`, `PRODUCTION=1`, or `PLANE_PRODUCTION=1`. Yet it rejects only `ident.source == "fallback"`. The `"env"` and `"socket"` paths are not rejected by that guard, even though neither label itself proves an SVID was fetched and validated.
5. `bind_issue_request()` replaces the request caller with the identity returned by that resolver. This protects against a plain body caller override by default, but the protection depends on the resolver returning a trustworthy principal.
6. The broker's production preflight is a separate check; its deployment configuration and whether it blocks these exact resolver paths were not established in this source review.

### Why this matters

A source label is metadata about how a string was obtained. It is not cryptographic evidence that the string names the authenticated workload.

A configured-but-unavailable or failed Workload API can therefore produce a non-`fallback` source label. The current required-mode check can accept that identity result without a verified SVID, depending on runtime environment. This is a **source-level fail-open path**, not proof that a deployed production instance is exploitable: external authentication, container policy, or preflight controls may constrain it, but those controls must be inspected and tested.

## Great Scale mapping

Let:
- (I) be the principal string used for authorization.
- (E) be verified identity evidence from a trusted Workload API/SVID validation path.
- (s(I)) be a source label such as `workload-api`, `env`, `socket`, or `fallback`.
- (P) mean production/required identity mode.

The intended rule is:

[
P \implies \operatorname{Verified}(E) \land
I=\operatorname{Principal}(E)
]

The observed guard is effectively:

[
P \land s(I)=\text{"fallback"} \implies \text{reject}
]

That is weaker than the intended invariant because:

[
s(I)\ne\text{"fallback"}
\centernot\implies \operatorname{Verified}(E)
]

In particular, `env` and `socket` describe alternative resolution paths, not successful SVID verification. This is the core mismatch: **a classification predicate is standing in for an evidence predicate**.

### Great Scale levels 8401–8410

- **8401 — Identity is a claim:** a SPIFFE-shaped string is not itself an authenticated principal.
- **8402 — Provenance is not proof:** source labels must not substitute for credential validation.
- **8403 — Required means verified:** production mode accepts only a successfully validated workload identity.
- **8404 — No synthetic principal in production:** development fallback identities are forbidden when identity is required.
- **8405 — No environment bypass:** environment-provided identity is configuration, not a cryptographic SVID.
- **8406 — Socket reachability is not identity:** connecting to a Unix socket does not prove an SVID was obtained.
- **8407 — Explicit state machine:** distinguish `verified`, `unavailable`, `invalid`, and `development-only`; reject all but `verified` in required mode.
- **8408 — One principal source:** issue, verify, and execute must consume the same trusted identity-boundary contract.
- **8409 — Evidence-bound receipts:** record authenticated principal provenance and identity evidence identifier, not merely a caller string.
- **8410 — Release gate:** production identity tests must demonstrate fail-closed behavior for every unavailable/invalid credential path.

### Mathematical safety invariant

If (V) is the set of principals backed by verified evidence, authorization must satisfy:

[
\operatorname{Authorize}(I, r) \implies I\in V
]

A label-only guard establishes no such implication. The correction is to make the resolver return either a verified identity object carrying validated evidence, or a typed failure. Production authorization must not accept a bare principal string from environment or synthetic fallback.

## Recommended remediation

1. In required/production mode, accept only the `workload-api` path after successful SVID retrieval and validation; reject `env`, `socket`, `fallback`, and caller override sources.
2. Make resolver outcomes explicit (verified identity vs typed error); do not return a synthetic development principal after a configured Workload API fails.
3. Ensure trust-domain allowlisting is applied to every accepted identity source, not just successful Workload API identities.
4. Bind the authenticated principal at the HTTP trust boundary and pass that immutable identity context into issue, verify, and execute handlers.
5. Add regression tests for: no socket; unreachable socket; reachable socket with missing client package; Workload API exception; disallowed trust domain; environment identity in required mode; synthetic fallback in required mode; caller override in required mode; successful verified SVID.
6. Add a deployment-level test proving that production preflight and gateway/mTLS policy cannot bypass the required identity state machine.

## Verification ledger

- **Source inspected:** `spiffe_identity.py`, `spiffe_binding.py`, and relevant issue-handler path in `server.py`.
- **Finding status:** source-level control-flow mismatch identified.
- **Mathematics:** invariant and counter-implication stated above.
- **Runtime exploit:** not demonstrated.
- **Tests run:** none in this integration step.
- **Build/deployment:** not run; external gateway and production preflight behavior remain unverified.
- **Code changes:** this document records the finding; no runtime behavior is changed by this document-only integration.

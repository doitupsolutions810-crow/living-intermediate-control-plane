# Great Scale descent: Levels 8501–8600
## Finding: cryptographic authority can silently degrade into a filesystem side effect

**Status:** source-level security finding; not yet demonstrated in a live deployment.

### Repository evidence

The capability-authority repository's `plane_service/crypto_sign.py` implements `_load()` as follows:

- It reads `PLANE_SIGNING_KEY`, defaulting to `config/broker_ed25519.pem`.
- If the path exists, it loads the PEM private key.
- If the path does not exist, it generates a new Ed25519 private key, creates the parent directory, and writes the private key with `Path.write_bytes()`.
- The write does not explicitly set restrictive file permissions, use exclusive creation, or verify the resulting mode/owner.
- `rings/production_profile.py::preflight()` checks SPIFFE source, broker measurement, and caller override, but the inspected code does not check that the signing key was provisioned securely, has restrictive permissions, is stable across restarts, or came from a production key-management source.
- `config/broker_ed25519.pem` is ignored by Git, which prevents ordinary commits but does not establish runtime filesystem confidentiality.

Sources inspected on `doitupsolutions810-crow/capability-authority@main`:
- `plane_service/crypto_sign.py` (blob SHA `1dc07f12f033583340999f3dab7ab434b08cce44`)
- `rings/production_profile.py` (blob SHA `96a371c00519022429d6295d435fe00c51089286`)
- `.gitignore` (contains `config/broker_ed25519.pem`)

### Why this is deeper than a key-file hygiene issue

Capability signatures are the trust root for the service's authorization artifacts. If a generated private key is readable by an unintended local principal, that principal may be able to mint signatures accepted by this process. If the file is absent and a new key is generated on startup, previously issued signatures may stop validating after a restart or across replicas using different keys. Which outcome occurs depends on deployment filesystem permissions, key mounts, process lifecycle, and replica topology; those runtime facts have not been verified.

The key point is the mismatch between a security-critical invariant and the implementation's fallback behavior: a missing production trust root is treated as permission to create one, not as a fatal configuration error.

### Great Scale mathematical form

Let (K) be the private signing key, (V_K) its corresponding public verification key, and (sigma = \operatorname{Sign}_K(m)).

Signature verification establishes only:
\[
\operatorname{Verify}_{V_K}(m,\sigma)=\text{true}.
\]

It does **not** establish that (K) was provisioned by an approved authority, is confidential, is stable across the service fleet, or belongs to the intended production trust epoch.

The required trust invariant is therefore stronger:
\[
\operatorname{Accept}(m,\sigma)
\Rightarrow
\operatorname{ValidSig}_{V_K}(m,\sigma)
\land \operatorname{ApprovedKey}(K)
\land \operatorname{Confidential}(K)
\land \operatorname{FleetConsistent}(V_K).
\]

The inspected fallback only attempts to ensure a key exists:
\[
\neg\operatorname{Exists}(K) \Rightarrow \operatorname{Generate}(K).
\]
That implication is not equivalent to production trust establishment.

### Levels 8501–8510: trust-root invariants

1. A missing production signing key is a startup error, not a key-generation request.
2. Separate development key bootstrap from production startup.
3. Require explicit key provenance and key identifier in the active signing configuration.
4. Enforce private-key file ownership and restrictive permissions before loading.
5. Prefer an approved KMS/HSM or secret-mounted key source where the deployment supports it.
6. Never silently create production key material as a side effect of signing or verifying.
7. Define rotation and overlap semantics for old and new verification keys.
8. Ensure every replica uses the intended verification trust set.
9. Emit a non-secret startup attestation of key ID, source, and validation result.
10. Fail closed when key provenance, permissions, or trust-set consistency cannot be established.

### Levels 8511–8520: testable security contracts

- Missing key + production mode must fail before serving requests.
- Missing key + explicit development mode may generate a key only under a documented policy.
- A private-key file with group/world-readable permissions must be rejected (subject to platform-specific permission semantics).
- A directory or non-regular file at the configured key path must be rejected.
- Concurrent first-start must not permit partial or competing key material.
- Restart must preserve the configured key identity when persistence is intended.
- Two replicas must verify each other's capability signatures when configured as one trust domain.
- Rotation tests must cover overlap, expiry, and retirement.
- Logs and error responses must never disclose key bytes or PEM material.
- Tests must distinguish signature correctness from key-provisioning correctness.

### Levels 8521–8530: release and evidence gates

- Production preflight validates the signing-key source, permissions, key ID, and rotation policy.
- Runtime health reports a non-secret key configuration status, not private material.
- Deployment manifests explicitly mount or reference the approved key source.
- CI tests the missing-key and insecure-permission paths.
- An integration test issues a capability in one replica and verifies it in another.
- A restart test proves intended key persistence or explicit rotation behavior.
- Verification evidence records the key identifier and policy version, not the secret.
- Key rotation has a rollback and incident-response procedure.
- A security review confirms filesystem semantics for each supported runtime/OS.
- Release is blocked if production starts by silently generating an unapproved trust root.

### Recommended remediation

1. Introduce an explicit mode split: development may bootstrap a local key; production must load a pre-provisioned key from an approved source.
2. In production, reject missing keys and reject insecure file permissions/ownership before accepting traffic.
3. Use atomic, restrictive creation only for the development bootstrap path; do not rely on the process umask as a security policy.
4. Define a stable key ID and a verification-key set that supports controlled rotation and multi-replica deployments.
5. Add tests for missing key, unreadable key, malformed key, insecure mode, restart persistence, replica consistency, and rotation.
6. Extend `rings/production_profile.py::preflight()` to validate key provisioning metadata without logging secrets.

### Verification ledger

- **Source inspected:** signing-key loader, production preflight, and ignore rule.
- **Finding status:** source-level trust-root/fallback mismatch identified.
- **Runtime exploit:** not demonstrated; actual file mode, deployment mounts, replicas, and restart behavior remain unverified.
- **Tests run:** none in this integration step.
- **Build/deployment:** not run.
- **Code changes:** this is a document-only integration; no signing or runtime behavior was changed.

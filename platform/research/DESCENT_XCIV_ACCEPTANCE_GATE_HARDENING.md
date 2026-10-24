# Descent XCIV — Accepted Evidence Must Carry Independent Trust Gates

Status: implementation hardening on `research/great-scale-evidence-contract`. The validator enforces the *shape and consistency* of authorization evidence; it does not itself verify cryptographic signatures, authenticate the capability issuer, or authorize an operation.

## Finding

A single `acceptance: "accepted"` field is an assertion, not proof. A numerically valid envelope can be copied, replayed, modified, or submitted by a caller who has no authority for the requested operation. Therefore the evidence contract must not allow a record to label itself accepted merely because its numerical fields are consistent.

The validator now requires an accepted envelope to include all of the following:

- `validation.domain_valid === true` and `validation.converged === true`;
- `execution.exit_code === 0`;
- a SHA-256 artifact digest and a non-empty signature reference;
- authorization status `authorized`, a capability reference, an explicit audience and operation, a verification reference, and an expiry timestamp later than the validation clock.

The clock is injectable as `{ now }` to make expiry tests deterministic. Provisional evidence may retain null values where information is unknown; null must not be converted into fabricated evidence.

## Great Scale invariance test

For `A_Q > 0`, let `e = (A_Q - |C|) / A_Q`. Then

```text
Psi_T = phi^(-2) + e/2 - e^2/4
```

Since `e` is invariant under common positive scaling of `A_Q) and `C`, the scalar is invariant too. A regression test checks the tuple `(C, A_Q, E_Q, tau) = (-1, 2, 1, 1/2)` against `(-7, 14, 7, 1/2)`. The signed Chern number remains a separate field because `Psi_T` cannot distinguish `C` from `-C`.

## Trust boundary

These checks do **not** prove that the digest was computed over the exact canonical payload, that the signature is valid, that the capability issuer is trusted, that the audience/operation matches a live request, or that the capability has not been revoked. A trusted integration layer must perform those checks and pass its durable verification reference into the envelope. The schema's `accepted` label is only meaningful when that trusted layer is the one producing/consuming the record.

Do not treat this structural validator as an authorization boundary. Fail closed for consequential operations if the external provenance, signature, capability, or receipt verification is missing or indeterminate.

## Verification record

- Added acceptance-gate checks for authorization fields, future expiry, successful execution, SHA-256 digest shape, and signature reference.
- Added a scale-invariance regression test and deterministic expiry-clock tests.
- Changes are committed to the evidence-contract branch.
- The full repository test suite and exact-head hosted workflow have **not** been verified in this note. A source-level/isolated test is not equivalent to `cd platform && npm test` or a green GitHub Actions run.

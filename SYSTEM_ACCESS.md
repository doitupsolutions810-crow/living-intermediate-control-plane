# SYSTEM_ACCESS

Self-readable entry point on the default branch for the Living Intermediate federation layer.

## Role in the compile

Living Intermediate is the federation and UI. Next.js cockpit, mTLS, attestation digests, procurement gate.

## Key files

- `integrate.mjs` — patched: residual S fetched live from Avrone's great_scale endpoint; unmeasured defaults to HOLD not READY (emergent-compile branch).
- `public/residual.cjs` — ESM twin of Great Scale's residual math.
- Emergent-compile branch carries the golden-vector parity import.

## Invariants

- Procurement gate requires measured residual; unmeasured cannot attest.
- Deny overrides allow.
- Residual math parity with Great Scale and Avrone enforced by harness.

## Adjacent layers

- Reads CONTROL12's attestation ledger for the harmonic dashboard.
- Avrone's Sovereign OS provides the sandboxes it federates.

This file is the federation layer's self-memory.

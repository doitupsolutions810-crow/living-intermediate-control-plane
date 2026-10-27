# GSLI Evidence Contract — residual-aware status (v5.4.0)

This document is the consolidation target for open evidence PRs against the residual geometry now on `main`.

## Single residual generator

```text
4S_T = log_φ(λ_T / λ_8) = Ψ_T − CONE
```

Every evidence status document **must** carry a residual block:

```json
"residual": {
  "logCoord": 0.292,
  "S": 0.073,
  "n": 7.708,
  "psi": 0.455,
  "cone": 0.382,
  "coneOk": true,
  "role": "Watch",
  "roleBlock": 4
}
```

`coneOk` must be `true` for the document to verify, and `S` must be finite and lie in the topology-derived domain `[0, 0.25]`. The predicate `coneCompliant(S)` is only a lower-bound check (`Ψ = CONE + S`); it is not a substitute for domain validation, measurement freshness, source/build binding, or signature verification.

## Namespaces (independent)

| Namespace | Gates | Meaning |
|-----------|-------|--------|
| **E** (evidence / procurement) | E0–E6 | Evidence-console contract only |
| **G** (production) | G0–G6 | Production acceptance — **never** implied by E |

Invariant: `ProcurementReady ≠ ProductionAuthorized`.  
`FORCE_PROCUREMENT` is diagnostic only and **never** authorizes.

## Document schema

`schema`: `great-scale.evidence-status/v5.4.0`

Required fields:

- `generatedAt`, `expiresAt` (source-issued freshness; default TTL 60s)
- `authority`: `public` | `local`
- `residual` (see above)
- `contractChecks`: **exactly** seven items `{ "id": "E0"…"E6", "status": "READY"|"HOLD" }` — no extra properties
- `namespaces.independent`: `true`
- `digest`: SHA-256 of canonical JSON body (excluding `signature`, `digest`, `keyId`, `note`)
- `keyId`, `signature`: optional; required for public authority

## Modules on main

| Module | Role |
|--------|------|
| `lib/great-scale-residual.mjs` | Cascade coordinate, cone, dual atlas |
| `lib/gate-namespaces.mjs` | E vs G evaluation |
| `lib/evidence-status-document.mjs` | build / seal / verify |
| `lib/evidence-authorization.mjs` | local opt-in + cone dual |
| `status/evidence-status.mjs` | CLI emit / verify |
| `status/write-status-file.mjs` | Persists `data/status.json` + `data/evidence-status.json` |
| `test/evidence-status-document.test.mjs` | 7 focused cases (including out-of-domain residual rejection) |

## Alignment with open PRs

### living-intermediate PR #29 / #31

| PR theme | Main status | Consolidation action |
|----------|-------------|----------------------|
| Remove FORCE as auth bypass | Done on main (`gate-namespaces`, integrate, procurement-bridge) | Prefer main; drop FORCE paths in PR |
| E0–E6 exact contract checks | Done (`evidence-status-document`) | Map PR schema to `contractChecks` shape above |
| Source freshness + digest + Ed25519 | Done (build/seal/verify) | Wire PR producer to `sealEvidenceStatusDocument` |
| Independent public key config | Done (env: `EVIDENCE_SOURCE_*`) | Keep consumer keys independent of producer |
| production G0–G6 separate | Done (`evaluateProductionAuthorization`) | Do not merge E success into G |

### control12-lattice-ops PR #31 (evidence-console producer)

| Theme | Consolidation action |
|-------|----------------------|
| GET `/api/status` | Emit `sealEvidenceStatusDocument(...)` payload |
| GET `/api/v1/evidence/schema` | Describe v5.4.0 fields + residual + E0–E6 exactness |
| Signing keys | Owner-approved Ed25519; never commit private keys |
| Fail-closed | No key → unsigned; public consumers require signature |

## Env contract

```text
EVIDENCE_SOURCE_PRIVATE_KEY_PEM   # producer only
EVIDENCE_SOURCE_PUBLIC_KEY_PEM    # consumer only
EVIDENCE_SOURCE_KEY_ID
GREAT_SCALE_S                     # optional residual heat override
ACCEPT_LOCAL_EVIDENCE=1           # explicit local opt-in
```

## Operator commands

```bash
npm run residual -- --S 0.073 --role 4
npm run evidence:emit -- --S 0.073 --role 4
npm run evidence:verify -- data/evidence-status.json --allow-unsigned
node test/evidence-status-document.test.mjs
node integrate.mjs status
# writes data/status.json and data/evidence-status.json
```

## Merge order recommendation

1. Keep **main** residual + gate-namespace + evidence-status-document as the contract authority.
2. Rebase open PRs onto main; replace overlapping FORCE / assumed-supply-chain / TypeScript-in-.mjs fragments with main modules.
3. Point the control12 evidence-console producer at `sealEvidenceStatusDocument`.
4. Deploy producer with owner-approved keys; run consumer verify against live `/api/status`.
5. Only then clear production G-namespace via separate supply-chain evidence.

Until live signed status verifies under the consumer public key, public procurement remains on HOLD; local opt-in remains explicit and cone-bound.

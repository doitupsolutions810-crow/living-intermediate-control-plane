# Production Acceptance Producer Contract — v1

Status: **consumer contract published; authoritative producer not yet verified**.

## Why this contract exists

The evidence-console trust contract (E0–E6) and production acceptance (G0–G6) are separate authorities. The E0–E6 producer's signed status can show that its own contract is internally valid; it cannot be relabeled as G0–G6 production acceptance.

Great Scale's repository audit describes the existing mismatch in `research/DESCENT_CLXXXVI_PRODUCER_CONSUMER_PROTOCOL_MISMATCH.md` and the missing production producer in `research/DESCENT_CXCVII_SIGNED_RESIDUAL_PROVENANCE.md` on the Great Scale evidence branch. That research states that the producer side remains unconfirmed. This file makes the consumer's required G0–G6 shape available to a future independent producer; it does not itself create a trusted producer.

## Machine-readable contract

Schema: `contracts/production-acceptance/v1.schema.json`

An attestation must contain exactly these fields:

- `schema`: `great-scale.production-acceptance/v1`
- `issuer`: `living-intermediate-control-plane-production-acceptance`
- `keyId`, `environment=production`, and the exact `buildId`
- `generatedAt`, `expiresAt`
- exactly one `PASS` entry for each `G0` through `G6`
- `residual`: a build-bound, source-bound, time-stamped measurement with schema `great-scale.residual-attestation/v1` and finite numeric `S`
- `digest` and `signature`

The canonical payload is produced by recursively sorting object keys and preserving array order. The digest is SHA-256 over the UTF-8 canonical payload. The Ed25519 signature is over those same canonical payload bytes, excluding the outer `digest` and `signature` properties. The verifier is authoritative for signature validation; JSON Schema alone cannot establish authenticity or authority.

## Candidate G0-G6 gate policy

The versioned policy manifest is `contracts/production-acceptance/gate-policy-v1.json`. The executable verifier carries the same policy in code, computes a canonical SHA-256 digest over its version and gate definitions, and rejects an attestation with a different policy version/digest. Each gate includes a policy ID and must reference its designated evidence suite.

| Gate | Policy ID | Required evidence suite | Intended criterion |
|---|---|---|---|
| G0 | `source-revision-binding` | `source-revision-binding` | Pinned repository/commit identity equals the workflow head. |
| G1 | `required-ci-suites-pass` | `required-ci-suites-pass` | Required suite set passed on the exact source revision and run attempt. |
| G2 | `immutable-artifact-provenance` | `immutable-artifact-provenance` | Artifact digest is pinned and provenance binds it to the source revision. |
| G3 | `supply-chain-attestation` | `supply-chain-attestation` | Required supply-chain provenance and SBOM attestations verify against an independent trust policy. |
| G4 | `security-policy-pass` | `security-policy-pass` | Required vulnerability and admission checks pass; skipped or unknown results deny acceptance. |
| G5 | `runtime-health` | `runtime-health` | A trusted live check observes the expected build/artifact in the target environment. |
| G6 | `residual-measurement` | `residual-measurement` | A fresh source-pinned, same-build residual is finite and satisfies the configured cone policy. |

These are **proposed contract meanings**, not a claim that current repository workflows already emit these seven named suites or that each criterion has been independently demonstrated. The deployment-controlled `PRODUCTION_ACCEPTANCE_REQUIRED_SUITES` must match this policy's exact seven-suite set. The authoritative producer must map observed job/run and external evidence into these bundles; it may not manufacture successful suite results or synthesize G0-G6 PASS values.

## Deployment trust requirements

The consumer must receive independently provisioned values for:

- `PRODUCTION_ACCEPTANCE_PUBLIC_KEY_PEM`
- `PRODUCTION_ACCEPTANCE_KEY_ID`
- `PRODUCTION_ACCEPTANCE_BUILD_ID`
- `PRODUCTION_ACCEPTANCE_RESIDUAL_SOURCE_ID`
- `PRODUCTION_ACCEPTANCE_REPOSITORY`
- `PRODUCTION_ACCEPTANCE_COMMIT_SHA`
- `PRODUCTION_ACCEPTANCE_ARTIFACT_DIGEST`
- `PRODUCTION_ACCEPTANCE_REQUIRED_SUITES` (comma-separated, deployment-owned suite names)
  The v1.0.0 gate policy currently requires exactly: `source-revision-binding,required-ci-suites-pass,immutable-artifact-provenance,supply-chain-attestation,security-policy-pass,runtime-health,residual-measurement`.
- `PRODUCTION_ACCEPTANCE_URL`

Do not generate a replacement production key at runtime or accept key identifiers and public keys supplied by the artifact itself. The exact source ID, build ID and key ID must match the deployment's pinned values.

The verifier rejects missing or extra fields, an incomplete/duplicated gate set, failed gates, schema mismatch, stale/future/expired timestamps, wrong key/build/source identity, digest/signature mismatch, non-finite residuals and out-of-cone residuals. The transport helper additionally requires HTTPS, exact final URL, no redirects, HTTP 200, JSON content type, no-cache, bounded size and bounded time.

## Required producer behavior

A producer must derive every G gate from authoritative checks and durable evidence, not caller-supplied Booleans or copied E0–E6 status. It must bind the attestation and residual to the same exact build, record what each G gate evaluated, and sign only after its evidence references have been verified.

The following must not authorize production:
- a healthy HTTP endpoint by itself;
- a valid E0–E6 procurement signature;
- a test fixture signed with an ephemeral key;
- a default/environment-derived `S=0` without an observed measurement;
- a `supplyChainOk: true` flag supplied by a caller;
- an unexecuted, runnerless, or uninspectable CI job.

## Promotion criteria

The production producer is considered connected only after all of the following are independently demonstrated:

1. A repository/deployment-owned emitter produces the v1 schema from authoritative G0–G6 results.
2. The residual measurement comes from the pinned source and matches the same build ID.
3. The producer's signing key lifecycle is safe and its public key is independently provisioned in the consumer.
4. Consumer tests accept a valid fixture and reject tampering, wrong source/key/build, expiry, missing gates, failed gates, an E0–E6 replay, and invalid residuals.
5. Executable hosted CI runs on the exact candidate SHA and produces inspectable passing steps.
6. The live deployed endpoint's status and signed attestation are verified against the independently pinned configuration.
7. Procurement and production remain separate decisions, with production **NO-GO** until every criterion passes.

Until these criteria are proven, the contract is specified but the producer connection remains **OPEN / HOLD**.

## Versioned G0–G6 gate policy

The contract now binds the signed attestation to `gatePolicyVersion=1.0.0` and the SHA-256 digest of the canonical `contracts/production-acceptance/gate-policy-v1.json` document. Each gate includes a fixed `policyId`; the verifier rejects a different policy version/digest, duplicate or missing gates, and evidence that cites a suite other than the one designated for that gate.

- **G0 — source-revision-binding:** pinned repository and full source commit match the workflow head.
- **G1 — required-ci-suites-pass:** all deployment-required suites pass on that exact commit and workflow attempt.
- **G2 — immutable-artifact-provenance:** artifact digest is pinned and provenance binds the artifact to the source.
- **G3 — supply-chain-attestation:** required provenance/SBOM attestations validate against independent trust policy.
- **G4 — security-policy-pass:** required security/admission checks pass; missing, skipped, or unknown results deny acceptance.
- **G5 — runtime-health:** trusted live health observes the expected build and artifact digest in production.
- **G6 — residual-measurement:** fresh, source-pinned, same-build residual is finite and meets the configured cone policy.

These identifiers and suite names define the contract, not proof that those real-world checks have executed. In particular, G2–G5 need producer-side integrations that independently collect and verify their underlying evidence. A signed string asserting those suites passed is not a replacement for those integrations.

## Proof-carrying contract status

The schema and verifier now require the following proof fields before an attestation can validate:

- `source.repository` and an exact 40-character `source.commitSha`, both compared against deployment-pinned repository/revision settings;
- an HTTPS GitHub Actions `execution.runUrl`, positive run ID and attempt, `conclusion=success`, completion time, and a workflow `headSha` equal to the source commit;
- a fixed `suiteResults` set compared against deployment-controlled `PRODUCTION_ACCEPTANCE_REQUIRED_SUITES`, with every suite successful and bound to the same source SHA, run ID, and attempt;
- an immutable artifact name and SHA-256 digest, with the digest compared against `PRODUCTION_ACCEPTANCE_ARTIFACT_DIGEST`;
- per-gate evidence references which must point to a declared successful suite and repeat that suite's signed evidence digest and observation time.

These checks prevent an attestation from reducing its own required-suite set, changing the source revision independently of the workflow run, or stating that a gate passed without a suite evidence reference. The complete proof is included in the canonical payload and covered by the Ed25519 signature.

## Remaining producer and live-verification boundary

The schema/verifier contract is stronger, but its fields remain claims until an authoritative producer populates them from independently observed CI and deployment evidence. The consumer validates run URL shape and cross-field consistency; it does not itself fetch GitHub's Actions API or download the artifact and verify its digest. Therefore the trusted producer must independently verify the named workflow run, its exact head SHA, required job/suite outcomes and attempt, and the artifact digest before signing. The producer signing identity must be independently provisioned; the artifact may not pick its own key.

The authoritative G0–G6 producer and deployment configuration are **not yet verified**. The schema is still a draft contract and must not be used to enable procurement or production authority until the producer performs those checks and the live signed artifact passes positive/negative end-to-end verification.


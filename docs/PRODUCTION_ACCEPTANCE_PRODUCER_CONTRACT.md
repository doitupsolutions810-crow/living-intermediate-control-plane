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
- `residual`: a build-bound, source-bound, time-stamped measurement with schema `great-scale.residual-attestation/v1` and finite numeric `S` in the topology-derived domain `[0, 0.25]`
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
| G6 | `residual-measurement` | `residual-measurement` | Fresh source-pinned same-build residual in `[0, 0.25]`, cone-compliant, and backed by an independently verified numerical certificate; empirical Richardson estimates alone do not certify G6. |

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
  The v1.0.3 gate policy currently requires exactly: `source-revision-binding,required-ci-suites-pass,immutable-artifact-provenance,supply-chain-attestation,security-policy-pass,runtime-health,residual-measurement`.
- `PRODUCTION_ACCEPTANCE_URL`

Do not generate a replacement production key at runtime or accept key identifiers and public keys supplied by the artifact itself. The exact source ID, build ID and key ID must match the deployment's pinned values.

The verifier rejects missing or extra fields, an incomplete/duplicated gate set, failed gates, schema mismatch, stale/future/expired timestamps, wrong key/build/source identity, digest/signature mismatch, non-finite residuals, out-of-domain residuals (`S` outside `[0, 0.25]`), and out-of-cone residuals. The transport helper additionally requires HTTPS, exact final URL, no redirects, HTTP 200, JSON content type, no-cache, bounded size and bounded time.

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

The contract now binds the signed attestation to `gatePolicyVersion=1.0.3` and the SHA-256 digest of the canonical `contracts/production-acceptance/gate-policy-v1.json` document. Each gate includes a fixed `policyId`; the verifier rejects a different policy version/digest, duplicate or missing gates, and evidence that cites a suite other than the one designated for that gate.

- **G0 — source-revision-binding:** pinned repository and full source commit match the workflow head.
- **G1 — required-ci-suites-pass:** all deployment-required suites pass on that exact commit and workflow attempt.
- **G2 — immutable-artifact-provenance:** artifact digest is pinned and provenance binds the artifact to the source.
- **G3 — supply-chain-attestation:** required provenance/SBOM attestations validate against independent trust policy.
- **G4 — security-policy-pass:** required security/admission checks pass; missing, skipped, or unknown results deny acceptance.
- **G5 — runtime-health:** trusted live health observes the expected build and artifact digest in production.
- **G6 — residual-measurement:** fresh, source-pinned, same-build residual is finite, within `[0, 0.25]`, and cone-compliant; its Great Scale receipt must also contain an independently verified `numericalCertification` proof. Richardson estimates remain diagnostic only.

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

The verifier also enforces workflow freshness: the successful run must have completed within the configured five-minute evidence window both at evaluation time and relative to attestation generation. A newly signed artifact cannot refresh an old CI run by itself. These checks are regression-tested.

The schema/verifier contract is stronger, but its fields remain claims until an authoritative producer populates them from independently observed CI and deployment evidence. The consumer validates run URL shape and cross-field consistency; it does not itself fetch GitHub's Actions API or download the artifact and verify its digest. Therefore the trusted producer must independently verify the named workflow run, its exact head SHA, required job/suite outcomes and attempt, and the artifact digest before signing. The producer signing identity must be independently provisioned; the artifact may not pick its own key.

The authoritative G0–G6 producer and deployment configuration are **not yet verified**. The schema is still a draft contract and must not be used to enable procurement or production authority until the producer performs those checks and the live signed artifact passes positive/negative end-to-end verification.




## G6 source receipt mapping

Great Scale's proposed schema-only G6 measurement receipt is `contracts/g6-residual-measurement/v1.schema.json` in the Great Scale repository. Its two build identities and two artifact identities are intentionally distinct:

- Great Scale `source.commitSha` must equal the receipt's successful workflow `execution.headSha`.
- Great Scale `measurementBuildId` identifies the source model/measurement build. It is **not** the Control Plane production build ID.
- Great Scale `artifact.digest` identifies the immutable Great Scale model/measurement artifact.
- Great Scale `target.commitSha` identifies the exact Control Plane source revision, and must equal the final G0-G6 attestation's `source.commitSha`.
- Great Scale `targetBuildId` identifies the intended Control Plane release. It must equal the final G0-G6 attestation's top-level `buildId`.
- Great Scale `targetArtifact.digest` identifies the intended Control Plane production artifact. It must equal the final G0-G6 attestation's `artifact.digest`.

Only after independently validating the receipt may the authoritative producer create the compact residual block used inside the signed G0-G6 attestation:

| G6 receipt field | Compact G0-G6 residual field | Binding rule |
|---|---|---|
| `measurement.STopological` | `residual.S` | Must equal the schema's bounded, finite topological residual value in `[0, 0.25]`; model diagnostics and mapping must pass |
| `measuredAt` | `residual.measuredAt` | Strict timestamp, valid ordering, not stale or in the future |
| pinned `issuer` | `residual.sourceId` | Must equal the deployment-configured residual source identity |
| `targetBuildId` | `residual.buildId` | Must equal the final G0-G6 attestation's top-level `buildId` |
| fixed downstream schema identity | `residual.schema` | Emit `great-scale.residual-attestation/v1`; do not copy the G6 receipt schema string |

The trusted producer must verify the receipt's Ed25519 signature under a separately pinned public key; fetch actual workflow/run/attempt metadata; verify successful result, exact source/head binding and run URL; check model parameters, input digest, model artifact digest and deployed pins; enforce timestamp freshness and expiry; and validate all required numerical diagnostics. The current model's `curvatureErrorEstimateWithSafetyFactor` and `metricAreaErrorEstimateWithSafetyFactor` are empirical Richardson estimates, explicitly labeled `richardson-asymptotic-estimate-only`; `modelG6CertificationEligible` is `false`. Do not treat `topologicalMappingValid`, `quadratureConverged`, or finite estimates as a rigorous certificate. G6 promotion additionally requires independent verification of `numericalCertification`: approved method, exact model source/input/measurement digests, durable proof artifact whose exact bytes match `proofDigest`, and certified curvature/metric-area upper bounds within `measurement.quadratureTolerance`. The numerical certificate must include `measurementDigest`, SHA-256 of the canonical exact QGT measurement object. The trusted producer recomputes that digest and rejects mismatch. The numerical certificate carries its own `certificateKeyId`, `certificateSignature`, `generatedAt`, and `expiresAt`; the signature is verified under a separately deployment-pinned numerical-certificate public key, distinct from the outer G6 receipt key. The trusted producer must verify certificate freshness, recompute the canonical measurement digest, fetch the proof artifact from a pinned HTTPS origin without redirects, recompute its SHA-256 digest, and verify the inner Ed25519 signature before accepting the claimed error bounds. Its `verified: true` field alone is only a claim. The receipt must not choose its own trust anchor or synthesize success from a declared field.

The receipt's Great Scale `artifact.digest` and the Control Plane `targetArtifact.digest` are never interchangeable. Likewise, `measurementBuildId` and `targetBuildId` are never interchangeable. Do not invent a shared composite build ID or copy one service's auto-generated ID into the other service's identity field. The schema provides distinct fields to keep those trust domains separate.

The Great Scale file is currently a JSON Schema, not an API or deployed producer. The Control Plane candidate now includes `lib/g6-residual-receipt.mjs` plus `test/g6-residual-receipt.test.mjs` as a fail-closed receipt-validation/mapping helper, wired into `npm test`; this helper is **not** connected to a live producer or to the production authorization path. It accepts only deployment-pinned identities/keys and caller-supplied proof bytes, and does not fetch authenticated workflow/artifact metadata or the proof URL itself. No live receipt, endpoint, key provisioning, or end-to-end verification has been established. The registry edge remains `proposed-not-verified`; the focused tests have not executed in Actions because the runner fails before steps. Until a trusted producer verifies the real receipt and the live positive/negative integration suite executes on exact pinned SHAs, G6 cannot pass and production remains HOLD / NO-GO.

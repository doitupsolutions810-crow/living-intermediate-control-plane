# Supply-chain report attestation

The procurement bridge treats `data/supply-chain-last.json` as untrusted input unless its detached Cosign bundle verifies against an explicitly configured signer identity and OIDC issuer.

## Required configuration

Set both variables in the trusted execution environment that runs the supply-chain check and procurement bridge:

- `SUPPLY_CHAIN_ATTESTATION_IDENTITY`: the exact certificate identity expected for the trusted CI workflow or signing principal. Obtain the value from the actual Cosign certificate/CI workflow; do not copy a guessed wildcard.
- `SUPPLY_CHAIN_ATTESTATION_ISSUER`: the exact OIDC issuer expected for that identity. For GitHub Actions keyless signing, verify the issuer from the actual certificate; do not assume a value without inspecting the signing result.

For a GitHub Actions keyless identity, the expected identity should be pinned to the specific trusted repository/workflow and protected ref appropriate to the release policy. Do not use an identity that permits arbitrary repositories or untrusted pull-request workflows.

## Flow

1. Run the supply-chain checks with `ALLOW_SKIP=0`, an immutable `IMAGE_REF=@sha256:<64-hex-digest>`, and `SUPPLY_CHAIN_SIGN=1`.
2. The runner writes `data/supply-chain-last.json` and signs those exact bytes into `data/supply-chain-last.bundle.json`.
3. The procurement bridge independently runs `cosign verify-blob` using the configured certificate identity and OIDC issuer.
4. The bridge authorizes the report only if verification succeeds and the report also passes freshness, revision, no-skip, immutable-image, scan, signing, and image-signature checks.

The bundle is intentionally separate from the JSON so adding signature metadata does not mutate the signed bytes. Any edit to the report after signing invalidates the signature.

## Fail-closed behavior

If either configuration value is missing, Cosign is unavailable, the bundle is absent, the signature does not verify, or the report is stale or mismatched, the supply-chain step fails or procurement remains on HOLD. Do not bypass this by setting a force flag.

This attestation protects the report's integrity and binds it to the configured signer identity. It does not make an untrusted workflow trustworthy: branch protection, trusted workflow review, least-privilege permissions, and a protected release ref remain necessary.

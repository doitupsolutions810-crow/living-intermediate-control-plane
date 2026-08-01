# Sigstore Cosign + Rekor

## Keyless (GitHub OIDC)

**`docs/oidc-cosign-keyless.md`** — Fulcio + OIDC + Rekor flow used in CI.

## Ecosystem

**`docs/sigstore-ecosystem.md`** — Cosign, Rekor, Fulcio, TSA, Gitsign, attest/SBOM, Policy Controller.

**`docs/gitsign.md`** — keyless **git commit** signing.

## Install Cosign

https://docs.sigstore.dev/cosign/system_config/installation/

## Install rekor-cli

```bash
brew install rekor-cli
plane rekor version
```

## Plane commands

```bash
IMAGE_REF=... npm run cosign:sign
IMAGE_REF=... npm run cosign:verify
IMAGE_REF=... npm run cosign:attest-sbom   # SBOM via syft or SBOM_PATH=
```

Optional TSA (timestamp) when signing locally:

```bash
cosign sign --timestamp-server-url https://timestamp.sigstore.dev/api/v1/timestamp IMAGE@DIGEST
```

## Operator host

```bash
npm run operator-host
```

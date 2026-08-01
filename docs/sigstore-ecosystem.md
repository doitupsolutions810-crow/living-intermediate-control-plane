# Sigstore ecosystem (integrated with the plane)

This plane already uses **Cosign** + **Rekor** (+ GitHub OIDC / Fulcio in CI). Additional Sigstore-related tools below extend the same trust model.

## Map

| Tool | Role | Plane integration |
|------|------|-------------------|
| **Cosign** | Sign/verify containers & blobs | `cosign:sign` / `cosign:verify` / CI hard verify |
| **Rekor** | Transparency log | tlog on sign; `rekor-cli` via `plane rekor` |
| **Fulcio** | Ephemeral CA for keyless | Used automatically via GitHub OIDC in CI |
| **Timestamp Authority (TSA)** | RFC 3161 timestamps | Optional Cosign `--timestamp-server-url` |
| **Gitsign** | Keyless **git commit** signing | `docs/gitsign.md` + optional host setup |
| **Cosign attest / attach** | SBOM & in-toto attestations | `npm run cosign:attest-sbom` |
| **Policy Controller** | K8s admission for signatures | See `k8s/` + upstream docs |

OIDC keyless primer: `docs/oidc-cosign-keyless.md`

## Install quick reference

```bash
# Cosign
# https://docs.sigstore.dev/cosign/system_config/installation/

# rekor-cli
brew install rekor-cli

# gitsign (commit signing)
# https://github.com/sigstore/gitsign#installation
go install github.com/sigstore/gitsign@latest
```

## CI (already)

- `id-token: write` → Fulcio keyless  
- GHCR push → `cosign sign` + **hard** `cosign verify`  
- Rekor upload with Cosign by default  

## Local plane commands

```bash
IMAGE_REF=ghcr.io/OWNER/living-intermediate-control-plane:ci npm run cosign:verify
IMAGE_REF=... npm run cosign:attest-sbom   # needs SBOM_PATH or generates via syft if present
plane rekor version
```

# SLSA provenance

## What CI produces

| Path | Artifact | Notes |
|------|----------|--------|
| Buildx | `slsa-provenance.json` | in-toto Statement + SLSA v1 predicate |
| Buildx | `image-inspect.json` | Local image metadata |
| Buildx | `actions/attest-build-provenance` | GitHub attestation (best-effort without registry push) |
| Kaniko | `slsa-provenance-kaniko.json` | Same statement shape, builder = kaniko |
| Kaniko | Syft SBOMs | SPDX + CycloneDX, then attested |

Buildx also sets `provenance: mode=max` and `sbom: true` on the build.

## Scope and limits

- **This repo (CI, no registry push):** provenance documents + optional GitHub attestations on files/SBOMs. Good for audit trails and artifact linkage.
- **Full SLSA Build L3 for containers:** typically requires pushing the image to a registry and using the official [slsa-github-generator](https://github.com/slsa-framework/slsa-github-generator) container workflow, or Sigstore-signed attestations attached to the image digest.

## Permissions

Workflow requests:

- `id-token: write` — OIDC for attestations
- `attestations: write` — store GitHub attestations

## Local verification (after downloading artifacts)

```bash
cat slsa-provenance.json
# subject name + digest should match the image you built
```

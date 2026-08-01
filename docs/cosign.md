# Sigstore Cosign integration

Sign and verify container images built from this plane.

## Concrete commands

```bash
# After building
npm run docker:build

IMAGE_REF=living-intermediate-control-plane:0.4.7 npm run cosign:sign
IMAGE_REF=living-intermediate-control-plane:0.4.7 npm run cosign:verify

# CLI equivalents
IMAGE_REF=living-intermediate-control-plane:0.4.7 plane cosign-sign
IMAGE_REF=living-intermediate-control-plane:0.4.7 plane cosign-verify
```

## Modes

| Mode | When |
|------|------|
| **Keyless** | GitHub Actions with `id-token: write` (recommended) |
| **Key pair** | Local: `COSIGN_PRIVATE_KEY` / `COSIGN_PUBLIC_KEY` |

Generate a local key (optional):

```bash
cosign generate-key-pair
```

## CI

After Buildx builds and loads the image, the workflow runs Cosign install + sign (keyless) when possible. Verification uses the same image ref.

Note: signing a locally loaded image without pushing to a registry may be limited; prefer signing a pushed digest in production pipelines.

## Env

| Variable | Purpose |
|----------|--------|
| `IMAGE_REF` | Image to sign/verify |
| `COSIGN_PRIVATE_KEY` | Key-based sign |
| `COSIGN_PUBLIC_KEY` | Key-based verify |
| `COSIGN_CERTIFICATE_IDENTITY` | Keyless verify identity |
| `COSIGN_CERTIFICATE_OIDC_ISSUER` | Keyless verify issuer |
| `ALLOW_SKIP=1` | Skip if cosign not installed |

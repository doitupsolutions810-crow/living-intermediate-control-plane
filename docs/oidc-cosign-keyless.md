# GitHub OIDC authentication & Cosign keyless signing

## What is keyless Cosign?

Traditional signing needs a long-lived private key you store and rotate.

**Keyless (Sigstore)** signing uses a short-lived certificate bound to your **identity** at sign time:

1. CI requests an **OIDC token** from GitHub Actions  
2. Sigstore’s Fulcio CA checks that token  
3. Fulcio issues a short-lived signing certificate (e.g. identity = `repo:OWNER/REPO:ref:refs/heads/main`)  
4. Cosign signs the image digest  
5. The signature + cert are recorded in **Rekor** (transparency log)  

No long-lived cosign key in repo secrets for the default CI path.

## GitHub OIDC in this plane

Workflow (`.github/workflows/plane-ci.yml`) already requests:

```yaml
permissions:
  id-token: write   # OIDC token for keyless Cosign
  contents: read
  packages: write   # GHCR push
```

On **main** push (when registry push is enabled):

```bash
cosign sign --yes "ghcr.io/<owner>/living-intermediate-control-plane@sha256:..."
cosign verify --certificate-identity-regexp ".*" --certificate-oidc-issuer-regexp ".*" "...@sha256:..."
```

Cosign uses the workflow’s OIDC token automatically when `id-token: write` is set and no key is provided.

### OIDC issuer / identity (for stricter verify)

Production verify should pin identity, for example:

```bash
cosign verify \
  --certificate-identity "https://github.com/OWNER/REPO/.github/workflows/plane-ci.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/OWNER/living-intermediate-control-plane@sha256:DIGEST
```

CI currently uses broad regexps so first-time verify succeeds across forks/paths; tighten identity in `plane-ci.yml` when the workflow path is stable.

## Learn the flow (mental model)

```text
GitHub Actions job
  → OIDC token (id-token: write)
  → Fulcio issues ephemeral cert
  → cosign sign image@digest
  → entry in Rekor transparency log
  → cosign verify (cert + Rekor)
```

| Piece | Role |
|-------|------|
| **OIDC** | Proves “this job is GitHub Actions for this repo/ref” |
| **Fulcio** | Issues short-lived cert for that identity |
| **Cosign** | Signs / verifies the artifact |
| **Rekor** | Public log that the signature existed |

## Local vs CI

| Environment | Typical mode |
|-------------|----------------|
| **CI (this repo)** | Keyless via GitHub OIDC + GHCR digest |
| **Local laptop** | Key pair **or** keyless only if you have another OIDC provider; often `cosign generate-key-pair` for experiments |

Local plane helpers:

```bash
IMAGE_REF=... npm run cosign:sign
IMAGE_REF=... npm run cosign:verify
```

Without keys, local sign may prompt or fail; registry + CI keyless is the supported production path.

## Operator host script

```bash
npm run operator-host
```

Runs `scripts/install-operator-host.sh` (unattended timer copy, rekor hint, SNYK/GHCR reminders).

## Related

- `docs/ci-registry-cosign.md` — push + hard verify behavior  
- `docs/cosign.md` — install Cosign / rekor-cli  
- `docs/next-ops.md` — set SNYK_TOKEN, confirm GHCR  

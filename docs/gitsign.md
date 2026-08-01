# Gitsign (Sigstore keyless git commits)

Gitsign signs **git commits** with the same Sigstore keyless model (OIDC + Fulcio + Rekor), complementary to Cosign on images.

## Install

```bash
go install github.com/sigstore/gitsign@latest
# or see https://github.com/sigstore/gitsign#installation
```

## One-time git config (operator host)

```bash
git config --global gpg.x509.program gitsign
git config --global gpg.format x509
git config --global commit.gpgsign true
# Optional: tag signing
# git config --global tag.gpgsign true
```

Commits then trigger browser/device OIDC (or ambient credentials where supported).

## Verify a commit

```bash
gitsign verify HEAD
# or
git verify-commit HEAD
```

## Relation to the plane

| Artifact | Tool |
|----------|------|
| Container image | Cosign |
| Git commit | Gitsign |
| Log | Rekor (both) |

Gitsign is **optional** on the operator host. Image admission still uses Cosign + CI.

# CI registry push + hard Cosign verify (OIDC keyless)

## OIDC

```yaml
permissions:
  id-token: write   # GitHub OIDC → Cosign keyless
  packages: write   # GHCR
```

Cosign uses this token with Fulcio; no long-lived signing key in secrets.

Learn more: `docs/oidc-cosign-keyless.md`.

## Behavior

| Event | Registry push | Cosign sign/verify |
|-------|---------------|--------------------|
| PR | No (local load) | Soft skip |
| Push to main / workflow_dispatch | **Yes** (GHCR) unless disabled | **Hard** on digest |

Disable push: repo variable `ENABLE_REGISTRY_PUSH=0`.

Image refs:

```text
ghcr.io/<owner-lowercase>/living-intermediate-control-plane:ci
ghcr.io/<owner-lowercase>/living-intermediate-control-plane:sha-<commit>
```

## Snyk hard gate

Secret **`SNYK_TOKEN`**: open-source + container Snyk **fail the job** on high+.  
Unset: explicit skip message only.

## Confirm after main push

1. Actions → Plane CI → Cosign sign + Cosign verify (hard)  
2. Packages → `living-intermediate-control-plane`  

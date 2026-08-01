# CI registry push + hard Cosign verify

## Behavior

| Event | Registry push | Cosign sign/verify |
|-------|---------------|--------------------|
| PR | No (local load only) | Soft skip |
| Push to main / workflow_dispatch | **Yes** (GHCR) unless disabled | **Hard** on digest |

Disable push:

- Repo variable `ENABLE_REGISTRY_PUSH=0`

Image refs:

```text
ghcr.io/<owner-lowercase>/living-intermediate-control-plane:ci
ghcr.io/<owner-lowercase>/living-intermediate-control-plane:sha-<commit>
```

Permissions: `packages: write`, `id-token: write` (keyless Cosign).

## Snyk hard gate

Set repository secret **`SNYK_TOKEN`**:

- Open-source and container Snyk steps **run and fail the job** on high+ findings  
- Without the secret, steps are explicitly skipped (message only) — not silent success with continue-on-error  

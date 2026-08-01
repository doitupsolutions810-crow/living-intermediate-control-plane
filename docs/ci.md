# CI integration

## Jobs

| Job | Purpose |
|-----|--------|
| `plane-checks` | Node doctor/test/health/smoke + **Trivy FS** |
| `docker-build` | **Buildx** image build (GHA layer cache) + doctor + **Trivy image** + SARIF |
| `kaniko-build` | **Kaniko** alternative build (no Docker daemon) + doctor + Trivy image |

`kaniko-build` runs on `workflow_dispatch` and on pushes to `main`.

## Build alternatives (coherent use)

| Builder | When to use |
|---------|-------------|
| **Buildx** | Default. Local Docker and standard GitHub-hosted runners. Best layer caching via GHA cache. |
| **Kaniko** | Runners or clusters where the Docker daemon / DinD is unavailable. Same Dockerfile, tar output for CI verification. |

Both consume the same `Dockerfile` and the same Trivy config (`trivy.yaml` / `.trivyignore`).

## Trivy

- Config: `trivy.yaml`
- Ignores: `.trivyignore` (example included; empty by default)
- Docs: `docs/trivy.md`

## Local commands

```bash
npm run ci
npm run docker:build
npm run docker:doctor
```

## Account-level caveat (Issue #3)

If Actions fails at `startup_failure` before jobs start, run the Node and Docker checks locally. Those results remain authoritative for limited-technicality decisions.

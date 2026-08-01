# CI integration

## Jobs

| Job | Purpose |
|-----|--------|
| `plane-checks` | Node checks + Trivy FS |
| `docker-build` | Buildx + doctor + Trivy + **OPA/Conftest** + SARIF |
| `kaniko-build` | Kaniko (**cache**) + doctor + **Syft SBOM** + Trivy + **OPA/Conftest** |

## Build alternatives

| Builder | When |
|---------|------|
| **Buildx** | Default; best GHA layer cache |
| **Kaniko** | No Docker daemon; local/remote layer cache; SBOM artifacts |

Kaniko cache details: `docs/kaniko.md`  
Trivy + OPA: `docs/trivy.md`

## Policy chain

1. Trivy applies `trivy.yaml` + `.trivyignore`
2. Conftest applies `policy/trivy-results.rego` to the JSON report
3. Job fails if either step denies

## Local

```bash
npm run ci
npm run docker:build
npm run docker:doctor
```

# Security overview (plain language)

## What the plane itself does

1. Checks readiness before important decisions  
2. Uses five fixed roles and a simple READY / not-READY rule  
3. Can pause and resume under operator control  
4. Records decisions locally  

Local authority for “may we proceed?” stays with readiness + doctor, not with CI alone.

## What CI adds

| Layer | Tool | Purpose |
|-------|------|--------|
| Code / FS scan | Trivy | Catch known issues in the repo |
| Image scan | Trivy | Catch issues in the built container |
| Policy | OPA / Conftest | Fail the job if CRITICAL/HIGH remain |
| SBOM | Syft | List what’s inside the Kaniko image |
| Provenance | SLSA-style JSON + attestations | Record how/when the image was built |
| Image shape | Distroless non-root | Smaller attack surface, no shell |

## Build paths

- **Buildx** — default, best layer cache on GitHub runners  
- **Kaniko** — when a Docker daemon is not available; includes cache, SBOM, provenance  

Both use the same Dockerfile.

## Operator commands

```bash
npm run doctor              # local integrity
npm run ci                  # full local check suite
npm run security-summary    # this posture as JSON
npm run docker:build
npm run docker:doctor
```

## Config files

- `trivy.yaml` — scan settings  
- `.trivyignore` — optional accepted findings (empty by default)  
- `policy/trivy-results.rego` — active OPA rules  
- `policy/examples/` — sample policies, not loaded unless copied  

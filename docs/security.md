# Security overview

## Local plane

1. Readiness + five roles before important decisions  
2. Optional doctor gate on procure  
3. Decision log and pause control  

## Vulnerability scanning + policy (integrated)

```bash
npm run security-scan
```

Runs **Trivy** (using `trivy.yaml`) then **OPA/Conftest** (`policy/trivy-results.rego`) on the JSON report.

| Step | Tool | Config |
|------|------|--------|
| FS / image scan | Trivy | `trivy.yaml`, `.trivyignore` |
| Policy enforce | Conftest / OPA | `policy/*.rego` |

Also included at the end of `npm run ci` (skips cleanly if tools are not installed unless `REQUIRE_SECURITY_TOOLS=1`).

## CI containers

- Distroless non-root image  
- Buildx + Kaniko  
- Trivy FS + image  
- OPA on scan JSON  
- Syft SBOM + SLSA-style provenance  

See `docs/trivy.md`, `docs/ci.md`, `docs/slsa.md`.

# OPA / Conftest policies

## Active policies

| File | Input | Rules |
|------|--------|--------|
| `trivy-results.rego` | Trivy JSON | CRITICAL/HIGH vulns, secrets, misconfig, package denylist |
| `snyk-results.rego` | Snyk JSON | CRITICAL/HIGH vulns, package denylist |

```bash
# Trivy report
conftest test --policy policy data/trivy-report.json

# Snyk report (package is snyk — use namespace or file)
conftest test --policy policy/snyk-results.rego data/snyk-test.json
```

`npm run security-scan` runs Conftest on both reports when present.

## Examples

| File | Purpose |
|------|--------|
| `deny-critical-only.rego` | Trivy CRITICAL only |
| `require-results.rego` | Trivy Results required |
| `max-vuln-count.rego` | Trivy total cap |
| `deny-fixed-only.rego` | Trivy fixable HIGH/CRITICAL |
| `deny-secret-any.rego` | Any Trivy secret |
| `snyk-critical-only.rego` | Snyk CRITICAL only |
| `snyk-max-count.rego` | Snyk total cap |

## Kubernetes Gatekeeper

OPA Gatekeeper manifests live under `k8s/gatekeeper/` (ConstraintTemplates + Constraints).
Those run in-cluster, not via Conftest on scan JSON.

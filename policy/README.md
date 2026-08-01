# OPA / Conftest policies

## Active (CI + `npm run security-scan`)

`trivy-results.rego` customized deny rules:

1. CRITICAL vulnerabilities  
2. HIGH vulnerabilities  
3. Denied package name patterns (`denied_packages` set)  
4. CRITICAL/HIGH secret findings  
5. CRITICAL/HIGH misconfigurations  
6. Missing `Results` array  

```bash
conftest test --policy policy data/trivy-report.json
```

## Examples (`policy/examples/`)

| File | Rule |
|------|------|
| `deny-critical-only.rego` | CRITICAL vulns only |
| `require-results.rego` | Report must include Results |
| `max-vuln-count.rego` | Total vuln cap |
| `deny-fixed-only.rego` | HIGH/CRITICAL only when FixedVersion is set |
| `deny-secret-any.rego` | Any secret finding |

Examples are **not** loaded by default. Copy into `policy/` or pass the file path to Conftest to try them.

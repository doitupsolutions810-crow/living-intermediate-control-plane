# Trivy + Snyk + OPA integration

## Local

```bash
npm run security-scan
IMAGE_REF=living-intermediate-control-plane:0.4.3 npm run security-scan
```

Order:

1. **Trivy** FS (+ image if `IMAGE_REF` set) using `trivy.yaml`  
2. **Snyk** `test` (+ `container test` if image set) — needs CLI + `SNYK_TOKEN` or prior `snyk auth`  
3. **Conftest/OPA** on Trivy JSON using customized `policy/trivy-results.rego`  

| Env | Effect |
|-----|--------|
| `ALLOW_SKIP=1` | Skip missing tools |
| `SKIP_TRIVY=1` | Skip Trivy |
| `SKIP_SNYK=1` | Skip Snyk |
| `SKIP_OPA=1` | Skip Conftest |
| `IMAGE_REF` | Enable image/container scans |
| `SNYK_TOKEN` | Authenticate Snyk |

## Why both Trivy and Snyk

| Tool | Strength |
|------|----------|
| Trivy | Fast FS/image/secret/misconfig; offline-friendly; feeds OPA JSON |
| Snyk | Strong app dependency graph + prioritization; container layer analysis |

OPA policy is applied to **Trivy JSON** (stable schema for Rego). Snyk results are gate checks on their own exit codes.

## Customized OPA deny rules (active)

See `policy/trivy-results.rego`:

- CRITICAL / HIGH vulnerabilities  
- Denied package name patterns  
- CRITICAL / HIGH secrets  
- CRITICAL / HIGH misconfigurations  
- Missing `Results` array  

## Example Rego

Under `policy/examples/` — not loaded unless you point Conftest at them or copy into `policy/`.

## GitHub Actions

- Trivy FS + image (required gate)  
- Conftest on Trivy JSON (required gate)  
- Snyk node + container (optional, needs `secrets.SNYK_TOKEN`)  

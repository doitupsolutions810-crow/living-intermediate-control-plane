# Policy enforcement (OPA / Conftest)

Rego policies applied to **Trivy JSON reports** after each image scan.

| File | Rule |
|------|------|
| `trivy-results.rego` | Deny CRITICAL and HIGH vulnerabilities in the report |

## Local use

```bash
trivy image --format json -o trivy-report.json living-intermediate-control-plane:0.3.7
conftest test --policy policy trivy-report.json
```

Exit code non-zero means policy denied the report.

These policies complement Trivy’s own severity exit codes: Trivy filters/ignores first (via `trivy.yaml` / `.trivyignore`), then OPA enforces the remaining findings.

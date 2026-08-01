# Trivy configuration and OPA policy

## Files

| File | Purpose |
|------|--------|
| `trivy.yaml` | Shared scan settings |
| `.trivyignore` | Optional accepted findings |
| `policy/trivy-results.rego` | OPA rules applied to Trivy JSON reports |

## Trivy options (`trivy.yaml`)

- Severity: CRITICAL, HIGH
- `ignore-unfixed: true`
- `ignorefile: .trivyignore`
- Scanners: vuln, secret, misconfig
- Skip dirs: data, .git, docs

CI passes `trivy-config: trivy.yaml` into Trivy steps.

## OPA / Conftest enforcement

After Trivy writes JSON (`trivy-report.json` or `trivy-kaniko-report.json`), Conftest evaluates `policy/`:

1. **Deny** any remaining CRITICAL vulnerability
2. **Deny** any remaining HIGH vulnerability
3. **Deny** malformed reports with no `Results` array

Flow:

```text
Trivy (severity + ignorefile) → JSON report → Conftest/OPA → pass/fail
```

Local:

```bash
trivy image --config trivy.yaml --format json -o trivy-report.json living-intermediate-control-plane:0.3.7
conftest test --policy policy trivy-report.json
```

## Ignore file example (`.trivyignore`)

```
# CVE-2023-12345  # reason: not reachable
# CVE-2024-00000 exp:2026-12-31  # accepted until base image bump
```

Prefer fixes over permanent ignores.

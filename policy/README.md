# Policy enforcement (OPA / Conftest)

## Active policy (CI)

| File | Rule |
|------|------|
| `trivy-results.rego` | Deny CRITICAL and HIGH in Trivy JSON reports |

```bash
conftest test --policy policy trivy-report.json
```

## Example policies (`policy/examples/`)

| File | What it shows |
|------|----------------|
| `deny-critical-only.rego` | Deny CRITICAL only |
| `require-results.rego` | Require a non-empty `Results` array |
| `max-vuln-count.rego` | Fail if total vulns exceed a threshold |

Examples are **not** loaded by CI (Conftest uses the `policy/` root only). Copy an example into `policy/` to activate it.

```bash
conftest test --policy policy/examples/deny-critical-only.rego trivy-report.json
```

Flow in CI:

```text
Trivy (trivy.yaml + .trivyignore) → JSON → Conftest (policy/*.rego) → pass/fail
```

# Evolution Log

## 2026-08-01 — Trivy + Snyk + customized OPA (0.4.3)

- Snyk integrated beside Trivy in `security-scan` and CI (optional token)
- Active Rego deny rules expanded: packages, secrets, misconfig, severity
- New example policies: deny-fixed-only, deny-secret-any

## 0.4.2

- Local security-scan (Trivy + OPA) wired into ci

# Trivy + OPA integration

## Local (plane-integrated)

```bash
# FS scan + OPA policy on the JSON report
npm run security-scan

# Also scan an image
IMAGE_REF=living-intermediate-control-plane:0.4.2 npm run security-scan

# Require tools (fail if trivy/conftest missing)
ALLOW_SKIP=0 npm run security-scan

# Trivy only / OPA only
SKIP_OPA=1 npm run security-scan
SKIP_TRIVY=1 npm run security-scan   # needs existing data/trivy-report.json
```

`npm run ci` includes `security-scan` with `ALLOW_SKIP=1` by default so local runs without Trivy still pass. Set `REQUIRE_SECURITY_TOOLS=1` to force tools.

## Config files

| File | Role |
|------|------|
| `trivy.yaml` | Severity, ignore-unfixed, scanners, skip-dirs, ignorefile |
| `.trivyignore` | Optional CVE/GHSA exceptions |
| `policy/trivy-results.rego` | OPA deny CRITICAL/HIGH on Trivy JSON |

## Flow

```text
Trivy (trivy.yaml + .trivyignore)
  → data/trivy-report.json
  → conftest test --policy policy
  → pass/fail
```

## GitHub Actions

Still runs native `aquasecurity/trivy-action` + `conftest-action` in `plane-ci.yml` (FS, Buildx image, Kaniko image).

## Install tools (examples)

```bash
# Trivy — https://aquasecurity.github.io/trivy/latest/getting-started/installation/
# Conftest — https://www.conftest.dev/install/
```

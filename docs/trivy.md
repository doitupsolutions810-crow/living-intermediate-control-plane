# Trivy configuration

## Files

| File | Purpose |
|------|--------|
| `trivy.yaml` | Shared scan settings (severity, scanners, skip dirs, ignore file path) |
| `.trivyignore` | Optional accepted findings (CVE / GHSA IDs) |

## Active options (`trivy.yaml`)

- **severity** — `CRITICAL`, `HIGH` (job fails on these)
- **exit-code** — `1` when findings remain after ignores
- **ignore-unfixed** — do not fail on issues with no upstream fix
- **ignorefile** — `.trivyignore`
- **scanners** — `vuln`, `secret`, `misconfig`
- **skip-dirs** — `data`, `.git`, `docs`
- **timeout** — `5m`

CI passes `trivy-config: trivy.yaml` into every Trivy action step.

## Ignore file example (`.trivyignore`)

```
# CVE-2023-12345  # reason: not reachable in this app path
# CVE-2024-00000 exp:2026-12-31  # reason: accepted until base image bump
# GHSA-xxxx-yyyy-zzzz  # GitHub advisory form also works
```

Rules:

1. Prefer upgrading the base image or dependency over ignoring.
2. Always add a short reason comment.
3. Use `exp:YYYY-MM-DD` when the ignore should expire.
4. Keep the file empty (comments only) unless a reviewed exception is required.

## Local scan examples

```bash
# Filesystem scan using project config
trivy fs --config trivy.yaml .

# Image scan after docker build
trivy image --config trivy.yaml living-intermediate-control-plane:0.3.6
```

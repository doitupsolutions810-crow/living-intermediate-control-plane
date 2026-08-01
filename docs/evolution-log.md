# Evolution Log

## 2026-08-01 — Trivy + OPA local integration (0.4.2)

- `npm run security-scan` — Trivy FS/image using `trivy.yaml`, then Conftest on JSON
- Wired into `npm run ci` (ALLOW_SKIP by default; REQUIRE_SECURITY_TOOLS=1 to force)
- Docs updated for local + Actions paths

## 0.4.1

- next advisor, doctor gate, richer snapshot

## 0.4.0

- security-summary, security docs milestone

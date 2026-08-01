# Examples

## `npm run doctor` (healthy)

Includes core readiness checks plus presence of Trivy policy, Snyk policy, and Gatekeeper manifests.

```bash
npm run doctor
```

Expect `ok: true` and checks for:

- package.json / config / data dir
- readiness READY, orchestration READY
- LaunchDesk actions
- plane state
- trivy policy present
- snyk policy present
- gatekeeper manifests present

## `npm run metrics`

```bash
npm run metrics
```

```json
{
  "total": 3,
  "byDecision": {
    "READY_FOR_PROCUREMENT": 2,
    "HOLD": 1
  }
}
```

## `npm run next`

State-aware recommended commands (procure, security-scan, metrics, …).

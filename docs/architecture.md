# Architecture — Living Intermediate Control Plane

## Purpose

Single control plane that unifies:

- Avrone Due’Krey identity & chat
- CONTROL12 local agent (deterministic evidence)
- Sovereign Platform + Fabric
- LaunchDesk operator orchestration
- Continuous attestation & federation

## Trust Boundary

All external actions are gated by:

1. Control704 proxy X / Y / Z data-set code override
2. Deterministic local-evidence readiness (READY required)
3. Sigstore / OIDC provenance on any published image
4. Organization-restricted policy (`doitupsolutions810-crow`)

## Data Flow (simplified)

```
Operator → LaunchDesk → Avrone bridge → Local Agent (quorum)
                                      ↓
                               Platform / Fabric workflows
                                      ↓
                               Attestation + Federation
```

## Next concrete steps

- Wire `avrone-chat` client into this repo’s bridge layer
- Expose LaunchDesk action endpoints that call the five-role agent SDK
- Add continuous readiness poller that mirrors the Terminal evidence format

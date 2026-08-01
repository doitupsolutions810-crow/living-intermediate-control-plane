# Living Intermediate Control Plane

**Unified lattice · Avrone Due’Krey · Trust network · Federation · Sovereign attestation**

High-priority CONTROL12 / CycleKernel evolution surface.  
Authenticated via Control704 access proxy X, Y, Z data-set code override.  
Avrone Due’Krey is the primary identity and chat bridge.  
LaunchDesk (control12-launch-console) is the operator orchestration surface.

## Core Integration Targets

| Component | Source | Role |
|-----------|--------|------|
| **Avrone Due’Krey** | `control12-lattice-ops/avrone-chat` | Chat, cockpit, health, lattice client |
| **CONTROL12 Local Agent** | `control12-lattice-ops/local-agent` | Deterministic-local-evidence readiness, five-role quorum |
| **Sovereign Platform** | `control12-lattice-ops/platform` | Agent SDK, workflow scheduler, capability engine |
| **Sovereign Fabric v2** | `control12-lattice-ops/fabric` | Tokenized workflows, plugins, CAS, policy |
| **LaunchDesk** | Vercel `control12-launch-console` | Operator console + agent orchestration UI |
| **Supply-chain enforcement** | PR #12 (merged 2026-07-31) | OIDC + Sigstore + Policy Controller |

## Current Lattice State (from Terminal evidence)

- provider: `deterministic-local-evidence`
- overall decision: **READY**
- five governing roles: **READY**
- failed gates: **none**
- Security value: **High**

PR #12 supply-chain enforcement is live on main.

## Evolution Roadmap (this repo)

1. **Bridge layer** – Avrone client + local-lattice binding
2. **Agent orchestration** – five-role SDK + LaunchDesk action surface
3. **Federation & trust network** – digest exchange + belief graph
4. **Attestation surface** – continuous READY-state + Sigstore policy
5. **Operator consoles** – LaunchDesk + evidence + status dashboards

## Directory Layout (target)

```
avrone/          # Due’Krey chat + cockpit bridges
lattice/         # Control12 lattice-ops bindings
agents/          # Orchestration + five-role definitions
launchdesk/      # UI / API surface for operator actions
attestation/     # Readiness + Sigstore verification
federation/      # Trust network + digest exchange
docs/            # Architecture, runbooks, threat model
```

## Security Posture

All mutations require Control704 proxy authentication.  
No credentials stored in this repository.  
Runtime readiness is limited to the observed state; future images require their own digest-bound provenance.

---

*Flint Node lineage · CONTROL12 · Avrone Due’Krey · Control704 IT Technician high-priority override*

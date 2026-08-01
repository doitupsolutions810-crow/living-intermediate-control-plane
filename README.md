# Living Intermediate Control Plane

Unified lattice · Avrone Due’Krey · LaunchDesk · Trust & attestation

Authenticated via Control704 access proxy X, Y, Z data-set code override.

## Current State

- Avrone bridge: present (`avrone/client.ts`)
- Readiness poller: present (`lattice/readiness-poller.mjs`) — emits deterministic-local-evidence READY schema
- Agent orchestration: present (`agents/orchestration.mjs`) — five-role plan + quorum
- LaunchDesk action bridge: present (`launchdesk/actions.mjs`)
- Plane status surface: present (`status/plane-status.mjs`)
- Evidence-console contract: restoration deployment previously completed (domain alias may still lag)
- Issue #3 (Actions startup): mitigated by workflow_dispatch-only + offline source checks

## Quick Commands

```bash
# Emit current readiness evidence
node lattice/readiness-poller.mjs

# Create and evaluate an orchestration plan
node -e "import('./agents/orchestration.mjs').then(m => console.log(m.evaluateQuorum(m.createOrchestrationPlan('evolve-system'))))"

# Plane status
node status/plane-status.mjs
```

## Directory Map

- `avrone/` — Due’Krey client and cockpit helpers
- `lattice/` — readiness and lattice bindings
- `agents/` — five-role orchestration
- `launchdesk/` — operator action surface
- `attestation/` — evidence contract notes
- `status/` — single-plane status emitter
- `docs/` — architecture, success criteria, mitigations

## Success Path (kept simple)

1. Local readiness stays READY
2. Evidence contract is available
3. LaunchDesk can request orchestration plans
4. All changes remain under Control704 override

Next natural steps: wire a live status endpoint, promote evidence-console domain, or add a small continuous poller service.

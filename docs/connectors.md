# Connectors, toolsets, skills, tools

Registry file: `connectors/manifest.json`  
View: `plane connectors` / `npm run connectors`

## Active in-plane

| Connector / toolset | Role |
|---------------------|------|
| **GitHub** | Repo truth, Actions CI, pushes |
| **plane_core** | checklist, procure, doctor, progress |
| **security_toolset** | Trivy, Snyk, OPA, Cosign, Rekor |
| **ollama_llama** | Coding agent + toolkit (chat auth) |
| **unattended toolset** | daily → self-develop → admit-change |
| **admission toolset** | upgrade-check, verify-changes, CI |

## Optional host connectors

| Connector | When to use |
|-----------|-------------|
| **Google Drive** | Share exported reports / decision logs |
| **Vercel** | Host a status microsite after admit |
| **Figma** | LaunchDesk UI design → code |
| **Gmail** | Alert on unattended failure |
| **Automations** | Scheduled Grok checks mirroring daily |

These are **not** required for the plane to run locally. They extend distribution and notification.

## Skills (Grok / operator)

| Skill | Plane use |
|-------|----------|
| docx / pdf / xlsx / pptx | Human-facing reports when requested |
| skill-creator | New plane skills |
| memory-edit | Operator preferences only when stated |
| ffmpeg | Only if media enters the workflow |

## Gate rules

1. Outside sandbox / agent toolkit → **chat authorization** (`plane agent-chat`)  
2. Inside session → allowlisted tools, **no per-action approve**  
3. Merge/release admission → **unattended / admit-change / CI** only  

## Commands

```bash
plane connectors
plane progress
plane agent-chat
plane unattended
plane admit-change
npm run ci
```

# Llama coding agent + toolkit

## Install model host (on the operator machine, not inside distroless)

```bash
# https://ollama.com
ollama pull llama3.2
# optional stronger coding models:
# ollama pull codellama
# ollama pull deepseek-coder-v2
```

Configure `agents/llama/config.json` (`baseUrl`, `model`).

The **plane image stays distroless** (runtime only). The agent runs on the host/repo checkout and talks to local Ollama — no outside sandbox unless you authorize chat.

## Authorize via chat (required for tools)

```bash
plane agent-chat
# prompt: Authorize this chat session? → y
```

Within the session:

- Allowlisted tools run **without per-action approval**
- Writes only under `workspace/`
- `/revoke` ends authority immediately

## Gate path

```text
chat /auth → agent toolkit → workspace/ proposals & tasks
        → plane unattended | plane admit-change → CI
```

```bash
plane unattended
plane admit-change
npm run ci
```

## Tools (allowlist)

list_tools, list_workspace, read_workspace_file, write_workspace_file,  
read_repo_file (read-only), run_plane_step, queue_auto_task, session_status

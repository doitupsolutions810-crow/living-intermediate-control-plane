# Llama coding agent (gated)

Local **Llama** coding assistant with an allowlisted toolkit.

## Rules

1. **No external sandbox** unless the user authorizes a session via the chat interface.  
2. Within an authorized session, allowlisted toolkit actions run **without per-action approval**.  
3. Work product only lands under `workspace/` (proposals, patches, task JSON).  
4. **Admission** is still only via `plane unattended`, `plane admit-change`, and **CI** — the agent cannot bypass doctor / verify-changes / scans.

## Requirements

- [Ollama](https://ollama.com) (recommended) with a code-capable model, e.g.:

```bash
ollama pull llama3.2
# or: ollama pull codellama
# or: ollama pull deepseek-coder-v2
```

Default API: `http://127.0.0.1:11434`

## Chat authorize + run

```bash
npm run agent:chat
# or
plane agent-chat
```

## One-shot prompt (session must already be authorized)

```bash
plane agent-run -- "summarize workspace tasks"
```

## Tool robustness

- `read_workspace_file` on a missing path throws a clear `workspace path not found` error (surfaced as `TOOL_RESULT`).
- `read_workspace_file` on a directory returns a JSON listing (same shape as `list_workspace`) instead of calling `readFileSync` (which threw `EISDIR` and crashed `agent:run`).
- `agentTurn` wraps each tool call: a thrown error becomes `TOOL_RESULT` `{"error":"..."}` so one bad call does not abort the turn.
- `write_workspace_file` accepts `content` or `value` for the file body.

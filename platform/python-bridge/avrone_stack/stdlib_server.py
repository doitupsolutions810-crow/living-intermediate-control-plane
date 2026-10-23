"""AVRONE HTTP bridge with fail-closed activation, client auth, and bounded bodies."""
from __future__ import annotations
import asyncio
import json
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from .settings import get_settings
from .swarm import swarm

MAX_REQUEST_BYTES = 1024 * 1024

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"[avrone-stack] {self.address_string()} {fmt % args}")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.send_header("vary", "Origin")
        origin = self.headers.get("Origin")
        allowed_origin = get_settings().allowed_origin
        if origin and allowed_origin and origin.rstrip("/") == allowed_origin:
            self.send_header("access-control-allow-origin", origin)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin", "").rstrip("/")
        allowed_origin = get_settings().allowed_origin
        if not allowed_origin or origin != allowed_origin:
            return self._json(403, {"error": "origin not allowed"})
        self.send_response(204)
        self.send_header("vary", "Origin")
        self.send_header("access-control-allow-origin", origin)
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("access-control-allow-headers", "content-type,authorization")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        s = get_settings()
        if path == "/health":
            return self._json(200, {
                "ok": True,
                "allow_agent_execution": s.execution_enabled(),
                "activation": s.activation_status(),
                "external_executor_configured": s.external_executor_configured(),
                "executor_auth_configured": s.executor_auth_configured(),
                "lattice_observe_on_route": s.lattice_observe_on_route,
                "lattice_configured": bool(s.lattice_token),
                "version": "0.2.0-safe-executor",
            })
        if path == "/v1/models":
            data = [{"id": s.executor_model, "object": "model", "owned_by": "external-executor"}] if s.external_executor_configured(require_https=False) else []
            return self._json(200, {"object": "list", "data": data})
        if path == "/v1/agents":
            return self._json(200, {"object": "list", "data": [{"id": n, "object": "agent"} for n in swarm.list_agents()]})
        return self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path != "/v1/chat/completions":
            return self._json(404, {"error": "not found"})
        s = get_settings()
        if not s.execution_enabled():
            return self._json(403, {"error": "Activation gate is not approved or the executor is not configured.", "activation": s.activation_status()})
        if not s.authorize_executor_request(self.headers.get("Authorization")):
            return self._json(401, {"error": "valid executor bearer credential required"})
        try:
            length = int(self.headers.get("content-length") or 0)
        except ValueError:
            return self._json(400, {"error": "invalid content length"})
        if length < 0:
            return self._json(400, {"error": "invalid content length"})
        if length > MAX_REQUEST_BYTES:
            return self._json(413, {"error": "request body exceeds 1 MiB limit"})
        raw = self.rfile.read(length) if length else b"{}"
        try:
            req = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._json(400, {"error": "invalid JSON"})
        if not isinstance(req, dict):
            return self._json(400, {"error": "request must be a JSON object"})
        messages = req.get("messages")
        if not isinstance(messages, list) or not messages or any(not isinstance(m, dict) for m in messages):
            return self._json(400, {"error": "messages must be a non-empty list"})
        if any(m.get("role") not in ("system", "user", "assistant") or not isinstance(m.get("content"), str) for m in messages):
            return self._json(400, {"error": "each message requires a supported role and text content"})
        if any(len(m["content"]) > 100000 for m in messages):
            return self._json(413, {"error": "message content exceeds the 100,000-character limit"})
        try:
            temperature = float(req.get("temperature", 0.7))
            max_tokens = req.get("max_tokens")
            if max_tokens is not None:
                max_tokens = int(max_tokens)
        except (TypeError, ValueError):
            return self._json(400, {"error": "temperature or max_tokens is invalid"})
        if not 0 <= temperature <= 2:
            return self._json(400, {"error": "temperature must be between 0 and 2"})
        session_id = str(req.get("session_id") or uuid.uuid4())
        user_content = next((m["content"] for m in reversed(messages) if m.get("role") == "user" and m.get("content")), "")
        if not user_content:
            return self._json(400, {"error": "no user message found"})
        try:
            result = asyncio.run(swarm.route(
                session_id=session_id, user_message=user_content, model=None,
                temperature=temperature, max_tokens=max_tokens, belief=req.get("belief"),
            ))
        except PermissionError:
            return self._json(403, {"error": "activation gate is not approved", "activation": s.activation_status()})
        except Exception as exc:  # noqa: BLE001
            print(f"[avrone-stack] executor request failed: {type(exc).__name__}")
            return self._json(502, {"error": "external executor request failed"})
        response = {
            "id": "chatcmpl-" + uuid.uuid4().hex[:12],
            "object": "chat.completion",
            "model": result.get("model") or s.executor_model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": result["content"]}, "finish_reason": "stop"}],
            "usage": result.get("usage"), "session_id": session_id,
            "routed_to": result.get("routed_to"), "lattice": result.get("lattice"), "evidence": result.get("evidence"),
        }
        return self._json(200, response)

def main() -> None:
    s = get_settings()
    server = ThreadingHTTPServer((s.host, s.port), Handler)
    print("AVRONE safe bridge on http://" + s.host + ":" + str(s.port)
          + " execution_enabled=" + str(s.execution_enabled())
          + " activation=" + str(s.activation_status()["decision"])
          + " external_executor_configured=" + str(s.external_executor_configured()))
    server.serve_forever()

if __name__ == "__main__":
    main()

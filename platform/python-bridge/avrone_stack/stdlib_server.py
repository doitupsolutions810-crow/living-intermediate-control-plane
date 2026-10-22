"""Stdlib-only AVRONE lab HTTP server (no FastAPI required).

Endpoints:
  GET  /health
  GET  /v1/models
  GET  /v1/agents
  POST /v1/chat/completions
"""
from __future__ import annotations

import json
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from .settings import get_settings
from .swarm import swarm


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"[avrone-stack] {self.address_string()} {fmt % args}")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("access-control-allow-origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("access-control-allow-origin", "*")
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
                "lattice_observe_on_route": s.lattice_observe_on_route,
                "lattice_url": s.lattice_url,
                "version": "0.1.0-lattice-stdlib",
            })
        if path == "/v1/models":
            return self._json(200, {
                "object": "list",
                "data": [{"id": s.default_model, "object": "model", "owned_by": "avrone"}],
            })
        if path == "/v1/agents":
            return self._json(200, {
                "object": "list",
                "data": [{"id": n, "object": "agent"} for n in swarm.list_agents()],
            })
        return self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path != "/v1/chat/completions":
            return self._json(404, {"error": "not found"})

        s = get_settings()
        if not s.execution_enabled():
            return self._json(403, {
                "error": "Activation gate is not approved. Refusing agent execution.",
                "activation": s.activation_status(),
            })

        length = int(self.headers.get("content-length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            req = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return self._json(400, {"error": "invalid json"})

        session_id = req.get("session_id") or str(uuid.uuid4())
        messages = req.get("messages") or []
        user_content = ""
        for message in reversed(messages):
            if message.get("role") == "user" and message.get("content"):
                user_content = message["content"]
                break
        if not user_content:
            return self._json(400, {"error": "No user message found"})

        import asyncio
        try:
            result = asyncio.run(swarm.route(
                session_id=session_id,
                user_message=user_content,
                model=req.get("model"),
                temperature=float(req.get("temperature") or 0.7),
                max_tokens=req.get("max_tokens"),
                belief=req.get("belief"),
            ))
        except PermissionError:
            return self._json(403, {
                "error": "Activation gate is not approved. Refusing agent execution.",
                "activation": s.activation_status(),
            })
        except Exception as exc:  # noqa: BLE001
            return self._json(500, {"error": str(exc)})

        response = {
            "id": "chatcmpl-" + uuid.uuid4().hex[:12],
            "object": "chat.completion",
            "model": result.get("model") or s.default_model,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": result["content"]},
                "finish_reason": "stop",
            }],
            "usage": result.get("usage"),
            "session_id": session_id,
            "routed_to": result.get("routed_to"),
            "lattice": result.get("lattice"),
            "evidence": result.get("evidence"),
        }
        return self._json(200, response)


def main() -> None:
    s = get_settings()
    server = ThreadingHTTPServer((s.host, s.port), Handler)
    print(
        "AVRONE stdlib stack on http://" + s.host + ":" + str(s.port)
        + " execution_enabled=" + str(s.execution_enabled())
        + " activation=" + str(s.activation_status()["decision"])
        + " LATTICE_OBSERVE_ON_ROUTE=" + str(s.lattice_observe_on_route)
    )
    server.serve_forever()


if __name__ == "__main__":
    main()

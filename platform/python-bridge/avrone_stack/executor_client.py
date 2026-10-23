"""Minimal OpenAI-compatible executor client with bounded, secret-safe failures."""
from __future__ import annotations
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 30

class _NoRedirect(HTTPRedirectHandler):
    """Do not forward Authorization across a provider-controlled redirect."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

_SAFE_OPENER = build_opener(_NoRedirect())

class ExecutorConnectionError(RuntimeError):
    """Safe error without upstream response bodies, keys, or request headers."""

def validate_executor_config(base_url: str, api_key: str, model: str, *, require_https: bool = False) -> str:
    if not isinstance(base_url, str) or not base_url.strip():
        raise ValueError("External executor base URL is missing.")
    parsed = urlsplit(base_url.strip())
    if parsed.scheme not in ("https", "http") or not parsed.hostname:
        raise ValueError("External executor URL must be an absolute HTTP(S) URL.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("External executor URL must not contain credentials, query, or fragment.")
    if require_https and parsed.scheme != "https":
        raise ValueError("Live mode requires HTTPS for the external executor.")
    if parsed.scheme == "http" and parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("Plain HTTP is permitted only for a loopback executor in non-live mode.")
    if not isinstance(api_key, str) or not api_key.strip():
        raise ValueError("External executor API key is missing.")
    if not isinstance(model, str) or not model.strip() or len(model) > 200:
        raise ValueError("External executor model is missing or invalid.")
    return base_url.strip().rstrip("/")

def _request_json(request: Request, *, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> dict[str, Any]:
    try:
        with _SAFE_OPENER.open(request, timeout=timeout) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        raise ExecutorConnectionError(f"External executor returned HTTP {exc.code}.") from None
    except (URLError, TimeoutError, OSError):
        raise ExecutorConnectionError("External executor could not be reached.") from None
    if len(raw) > MAX_RESPONSE_BYTES:
        raise ExecutorConnectionError("External executor response exceeded the size limit.")
    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ExecutorConnectionError("External executor returned invalid JSON.") from None
    if not isinstance(result, dict):
        raise ExecutorConnectionError("External executor returned an unexpected response.")
    return result

def probe_executor(base_url: str, api_key: str, model: str, *, require_https: bool = False, timeout: int = 5) -> dict[str, Any]:
    base = validate_executor_config(base_url, api_key, model, require_https=require_https)
    request = Request(base + "/models", headers={"Authorization": "Bearer " + api_key, "Accept": "application/json"}, method="GET")
    result = _request_json(request, timeout=timeout)
    model_rows = result.get("data")
    if not isinstance(model_rows, list):
        raise ExecutorConnectionError("External executor /models response did not contain a model list.")
    if not any(isinstance(row, dict) and row.get("id") == model for row in model_rows):
        raise ExecutorConnectionError("Configured model was not listed by the external executor.")
    return {"ok": True, "modelAvailable": True}

def chat_completion(base_url: str, api_key: str, model: str, messages: list[dict[str, str]],
                    temperature: float = 0.7, max_tokens: int | None = None,
                    *, require_https: bool = True, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> dict[str, Any]:
    base = validate_executor_config(base_url, api_key, model, require_https=require_https)
    if not isinstance(messages, list) or not messages or any(
        not isinstance(message, dict) or message.get("role") not in ("system", "user", "assistant")
        or not isinstance(message.get("content"), str) for message in messages
    ):
        raise ValueError("Messages must be a non-empty list of role/content pairs.")
    if not isinstance(temperature, (int, float)) or not 0 <= float(temperature) <= 2:
        raise ValueError("Temperature must be between 0 and 2.")
    payload: dict[str, Any] = {"model": model, "messages": messages, "temperature": float(temperature)}
    if max_tokens is not None:
        if not isinstance(max_tokens, int) or not 1 <= max_tokens <= 8192:
            raise ValueError("max_tokens must be between 1 and 8192.")
        payload["max_tokens"] = max_tokens
    request = Request(base + "/chat/completions", data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json", "Accept": "application/json"}, method="POST")
    result = _request_json(request, timeout=timeout)
    choices = result.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise ExecutorConnectionError("External executor response did not contain a completion.")
    message = choices[0].get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str):
        raise ExecutorConnectionError("External executor completion did not contain text.")
    usage = result.get("usage") if isinstance(result.get("usage"), dict) else {}
    safe_usage = {"prompt_tokens": usage.get("prompt_tokens", 0),
                  "completion_tokens": usage.get("completion_tokens", 0),
                  "total_tokens": usage.get("total_tokens", 0)}
    return {"content": content, "model": str(result.get("model") or model), "usage": safe_usage}

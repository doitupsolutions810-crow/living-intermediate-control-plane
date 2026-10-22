"""Execution gate and provider settings; never exposes secret values."""
from __future__ import annotations
import hmac
import os
from .activation_gate import evaluate_evidence_file
from .executor_client import validate_executor_config

MIN_EXECUTOR_TOKEN_LENGTH = 32

class Settings:
    def __init__(self) -> None:
        self.allow_agent_execution = os.getenv("ALLOW_AGENT_EXECUTION", "false").lower() in ("1", "true", "yes")
        self.activation_mode = os.getenv("AVRONE_ACTIVATION_MODE", "preview").lower().strip()
        self.activation_evidence_file = os.getenv("AVRONE_ACTIVATION_EVIDENCE_FILE", "").strip()
        self.release_sha = os.getenv("AVRONE_RELEASE_SHA", "").strip()
        self.executor_bearer_token = os.getenv("AVRONE_EXECUTOR_BEARER_TOKEN", "")
        self.executor_base_url = os.getenv("AVRONE_EXTERNAL_EXECUTOR_URL", "").strip().rstrip("/")
        self.executor_api_key = os.getenv("AVRONE_EXTERNAL_EXECUTOR_API_KEY", "")
        default_model = os.getenv("DEFAULT_MODEL", "avrone-local-stub").strip()
        self.executor_model = os.getenv("AVRONE_EXTERNAL_EXECUTOR_MODEL", "" if default_model == "avrone-local-stub" else default_model).strip()
        self.allowed_origin = os.getenv("AVRONE_ALLOWED_ORIGIN", "").strip().rstrip("/")
        self.lattice_url = os.getenv("CONTROL12_PLATFORM_URL", "http://127.0.0.1:4400").rstrip("/")
        self.lattice_token = os.getenv("CONTROL12_PLATFORM_TOKEN", "")
        self.lattice_observe_on_route = os.getenv("LATTICE_OBSERVE_ON_ROUTE", "1") == "1"
        self.control12_lattice_root = os.getenv("CONTROL12_LATTICE_ROOT", "avrone-duekrey")
        self.host = os.getenv("AVRONE_STACK_HOST", "127.0.0.1")
        self.port = int(os.getenv("AVRONE_STACK_PORT", "8000"))

    def executor_auth_configured(self) -> bool:
        return len(self.executor_bearer_token) >= MIN_EXECUTOR_TOKEN_LENGTH

    def external_executor_configured(self, *, require_https: bool | None = None) -> bool:
        if require_https is None:
            require_https = self.activation_mode == "live"
        try:
            validate_executor_config(self.executor_base_url, self.executor_api_key, self.executor_model, require_https=require_https)
            return True
        except ValueError:
            return False

    def authorize_executor_request(self, authorization: str | None) -> bool:
        expected = "Bearer " + self.executor_bearer_token
        return self.executor_auth_configured() and isinstance(authorization, str) and hmac.compare_digest(authorization, expected)

    def activation_status(self) -> dict:
        result = evaluate_evidence_file(self.activation_evidence_file, self.activation_mode, self.release_sha)
        evidence_allowed = bool(result.get("liveExecutionAllowed"))
        auth_ready = self.executor_auth_configured()
        executor_ready = self.external_executor_configured(require_https=self.activation_mode == "live")
        allowed = evidence_allowed and auth_ready and executor_ready
        blockers = len(result.get("blockers", []))
        if self.activation_mode == "live" and evidence_allowed:
            blockers += int(not auth_ready) + int(not executor_ready)
        decision = result.get("decision", "BLOCKED")
        if decision == "LIVE_APPROVED" and not allowed:
            decision = "BLOCKED"
        return {
            "decision": decision,
            "liveExecutionAllowed": allowed,
            "blockerCount": blockers,
            "executorAuthConfigured": auth_ready,
            "externalExecutorConfigured": executor_ready,
        }

    def execution_enabled(self) -> bool:
        return self.allow_agent_execution and self.activation_mode == "live" and self.activation_status()["liveExecutionAllowed"]

    def require_execution_gate(self) -> None:
        if not self.allow_agent_execution:
            raise PermissionError("ALLOW_AGENT_EXECUTION is not true. Refusing agent execution.")
        if self.activation_mode != "live":
            raise PermissionError("AVRONE_ACTIVATION_MODE is not live. Preview mode refuses agent execution.")
        status = self.activation_status()
        if not status["liveExecutionAllowed"]:
            raise PermissionError("Activation gate blocked execution; check current evidence, executor identity, and HTTPS provider configuration.")

_settings: Settings | None = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

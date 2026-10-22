"""Execution gate and dual-plane env."""
from __future__ import annotations

import os

from .activation_gate import evaluate_evidence_file


class Settings:
    def __init__(self) -> None:
        self.allow_agent_execution = os.getenv("ALLOW_AGENT_EXECUTION", "false").lower() in (
            "1", "true", "yes",
        )
        self.activation_mode = os.getenv("AVRONE_ACTIVATION_MODE", "preview").lower().strip()
        self.activation_evidence_file = os.getenv("AVRONE_ACTIVATION_EVIDENCE_FILE", "").strip()
        self.release_sha = os.getenv("AVRONE_RELEASE_SHA", "").strip()
        self.default_model = os.getenv("DEFAULT_MODEL", "avrone-local-stub")
        self.lattice_url = os.getenv("CONTROL12_PLATFORM_URL", "http://127.0.0.1:4400").rstrip("/")
        self.lattice_token = os.getenv("CONTROL12_PLATFORM_TOKEN", "")
        self.lattice_observe_on_route = os.getenv("LATTICE_OBSERVE_ON_ROUTE", "1") == "1"
        self.control12_lattice_root = os.getenv("CONTROL12_LATTICE_ROOT", "avrone-duekrey")
        self.host = os.getenv("AVRONE_STACK_HOST", "127.0.0.1")
        self.port = int(os.getenv("AVRONE_STACK_PORT", "8000"))

    def activation_status(self) -> dict:
        result = evaluate_evidence_file(self.activation_evidence_file, self.activation_mode, self.release_sha)
        # Do not publish evidence references or individual internal records from /health.
        return {
            "decision": result.get("decision", "BLOCKED"),
            "liveExecutionAllowed": bool(result.get("liveExecutionAllowed")),
            "blockerCount": len(result.get("blockers", [])),
        }

    def execution_enabled(self) -> bool:
        return self.allow_agent_execution and self.activation_status()["liveExecutionAllowed"]

    def require_execution_gate(self) -> None:
        if not self.allow_agent_execution:
            raise PermissionError("ALLOW_AGENT_EXECUTION is not true. Refusing agent execution.")
        if self.activation_mode != "live":
            raise PermissionError("AVRONE_ACTIVATION_MODE is not live. Preview mode refuses agent execution.")
        status = self.activation_status()
        if not status["liveExecutionAllowed"]:
            raise PermissionError(
                "Activation gate blocked live execution. Verify the eight success criteria and refresh the evidence file."
            )


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

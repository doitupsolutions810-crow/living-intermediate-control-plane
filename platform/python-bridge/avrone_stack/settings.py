"""Execution gate and dual-plane env."""

from __future__ import annotations

import os


class Settings:
    def __init__(self) -> None:
        self.allow_agent_execution = os.getenv("ALLOW_AGENT_EXECUTION", "false").lower() in (
            "1",
            "true",
            "yes",
        )
        self.default_model = os.getenv("DEFAULT_MODEL", "avrone-local-stub")
        self.lattice_url = os.getenv("CONTROL12_PLATFORM_URL", "http://127.0.0.1:4400").rstrip("/")
        self.lattice_token = os.getenv("CONTROL12_PLATFORM_TOKEN", "")
        self.lattice_observe_on_route = os.getenv("LATTICE_OBSERVE_ON_ROUTE", "1") == "1"
        self.control12_lattice_root = os.getenv("CONTROL12_LATTICE_ROOT", "avrone-duekrey")
        self.host = os.getenv("AVRONE_STACK_HOST", "127.0.0.1")
        self.port = int(os.getenv("AVRONE_STACK_PORT", "8000"))

    def require_execution_gate(self) -> None:
        if not self.allow_agent_execution:
            raise PermissionError(
                "ALLOW_AGENT_EXECUTION is not true. Refusing agent execution."
            )


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

"""Layer 13 — Swarm with optional lattice observation on every route."""

from __future__ import annotations

from typing import Any
import uuid

from .settings import get_settings
from .react import ReasoningTrace

try:
    from avrone_bridge.lattice_client import LatticeClient
    from avrone_bridge.react_lattice import attach_lattice_observation
except ImportError:  # pragma: no cover
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from avrone_bridge.lattice_client import LatticeClient
    from avrone_bridge.react_lattice import attach_lattice_observation


class SwarmOrchestrator:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.agents = ["general", "analyst", "safety", "coder", "researcher", "planner", "reviewer"]

    def list_agents(self) -> list[str]:
        return list(self.agents)

    def _classify(self, text: str) -> str:
        t = text.lower()
        if any(k in t for k in ("code", "function", "bug", "implement", "python", "refactor")):
            return "coder"
        if any(k in t for k in ("risk", "safe", "policy", "jailbreak", "harm")):
            return "safety"
        if any(k in t for k in ("plan", "roadmap", "steps", "milestone")):
            return "planner"
        if any(k in t for k in ("research", "investigate", "sources", "evidence")):
            return "researcher"
        if any(k in t for k in ("review", "critique", "improve", "quality")):
            return "reviewer"
        if any(k in t for k in ("analyze", "compare", "trade-off", "architecture")):
            return "analyst"
        return "general"

    async def route(
        self,
        session_id: str,
        user_message: str,
        preferred: str | None = None,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        belief: float | None = None,
    ) -> dict[str, Any]:
        self.settings.require_execution_gate()

        trace = ReasoningTrace()
        lattice_obs = None

        if self.settings.lattice_observe_on_route:
            client = LatticeClient(
                base_url=self.settings.lattice_url,
                token=self.settings.lattice_token or None,
            )
            lattice_obs = await attach_lattice_observation(
                trace,
                client,
                belief=belief,
                session_id=session_id,
            )

        route = preferred if preferred in self.agents else self._classify(user_message)
        trace.add_thought(f"Route selected: {route}")
        trace.add_action("domain_agent", {"route": route, "session_id": session_id})

        obs_line = lattice_obs.observation if lattice_obs else "lattice: skipped"
        content = (
            f"[avrone-stack/{route}] session={session_id}\n"
            f"Lattice: {obs_line}\n"
            f"Response is provisional. External model not bound in this lab plane.\n"
            f"User: {user_message[:500]}"
        )
        trace.add_observation(f"stub_complete route={route}")
        trace.final_answer = content

        return {
            "content": content,
            "model": model or self.settings.default_model,
            "routed_to": route,
            "session_id": session_id,
            "lattice": lattice_obs.as_react_step() if lattice_obs else None,
            "trace_steps": len(trace.steps),
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "evidence": {
                "schema": "avrone.route-evidence/v1",
                "session_id": session_id,
                "turn_id": str(uuid.uuid4()),
                "lattice_root": self.settings.control12_lattice_root,
                "lattice_observation": lattice_obs.observation if lattice_obs else None,
            },
        }


swarm = SwarmOrchestrator()

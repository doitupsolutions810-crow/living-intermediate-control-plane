"""ReAct harness helpers that inject lattice observations.

Compatible with AVRONE Layer 11 ReasoningTrace shape:
  thought → action → observation
"""

from __future__ import annotations

from typing import Any

from .lattice_client import LatticeClient, LatticeObservation


def build_system_prompt_with_lattice(
    base: str,
    observation: LatticeObservation | None = None,
    tools_description: str = "",
) -> str:
    lattice_block = ""
    if observation is not None:
        lattice_block = (
            "\nLattice observation (provisional, Control12):\n"
            f"{observation.observation}\n"
        )
    return (
        f"{base}\n\n"
        "You are operating inside the AVRONE production stack under Control12 lattice attestation.\n"
        "When tools are available, reason step-by-step (Thought → Action → Observation) before the final answer.\n"
        f"{lattice_block}"
        f"{tools_description}"
    )


async def attach_lattice_observation(
    trace: Any,
    client: LatticeClient | None = None,
    *,
    belief: float | None = None,
    session_id: str | None = None,
    node_id: str = "lattice",
) -> LatticeObservation:
    """
    Append a lattice observe step onto an AVRONE ReasoningTrace-like object.

    Expected trace API (from attachments/react.py):
      add_thought / add_action / add_observation
    """
    client = client or LatticeClient()
    obs = await client.observe(belief=belief, node_id=node_id, session_id=session_id)
    step = obs.as_react_step()

    if hasattr(trace, "add_thought"):
        trace.add_thought(step["thought"])
    if hasattr(trace, "add_action"):
        trace.add_action(step["action"], step["action_input"])
    if hasattr(trace, "add_observation"):
        trace.add_observation(step["observation"])

    return obs

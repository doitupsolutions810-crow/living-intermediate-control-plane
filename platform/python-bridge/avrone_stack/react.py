"""Layer 11 — Reasoning harness (ReAct style)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ReasoningStep:
    thought: str
    action: str | None = None
    action_input: dict | None = None
    observation: str | None = None


@dataclass
class ReasoningTrace:
    steps: list[ReasoningStep] = field(default_factory=list)
    final_answer: str | None = None

    def add_thought(self, thought: str) -> None:
        self.steps.append(ReasoningStep(thought=thought))

    def add_action(self, action: str, action_input: dict) -> None:
        if not self.steps:
            self.steps.append(ReasoningStep(thought=""))
        self.steps[-1].action = action
        self.steps[-1].action_input = action_input

    def add_observation(self, observation: str) -> None:
        if self.steps:
            self.steps[-1].observation = observation

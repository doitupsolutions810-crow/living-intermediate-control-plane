"""HTTP client for the Node living-intermediate control plane.

Pulls security/status, spectrum, and federation snapshot so the AVRONE
ReAct harness can treat lattice state as real observations (not mocks).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
import os

import httpx


@dataclass
class LatticeObservation:
    schema: str = "control12.lattice-observation/v1"
    node_id: str = "lattice"
    session_id: str | None = None
    observation: str = ""
    belief: float | None = None
    security: dict[str, Any] | None = None
    spectrum: dict[str, Any] | None = None
    federation: dict[str, Any] | None = None
    provisional: bool = True
    raw: dict[str, Any] = field(default_factory=dict)

    def as_react_step(self, thought: str = "Observe lattice state before acting.") -> dict[str, Any]:
        return {
            "thought": thought,
            "action": "lattice_observe",
            "action_input": {"nodeId": self.node_id, "sessionId": self.session_id},
            "observation": self.observation,
            "structured": {
                "schema": self.schema,
                "nodeId": self.node_id,
                "sessionId": self.session_id,
                "belief": self.belief,
                "security": self.security,
                "spectrum": self.spectrum,
                "federation": self.federation,
                "provisional": self.provisional,
            },
        }


class LatticeClient:
    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        timeout: float = 15.0,
    ) -> None:
        self.base_url = (base_url or os.getenv("CONTROL12_PLATFORM_URL", "http://127.0.0.1:4400")).rstrip("/")
        self.token = token if token is not None else os.getenv("CONTROL12_PLATFORM_TOKEN", "")
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        h = {"accept": "application/json"}
        if self.token:
            h["authorization"] = f"Bearer {self.token}"
        return h

    async def _get(self, path: str) -> dict[str, Any] | None:
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, headers=self._headers())
                if resp.status_code >= 400:
                    return None
                return resp.json()
        except Exception:
            return None

    async def security_status(self) -> dict[str, Any] | None:
        return await self._get("/api/v1/security/status")

    async def spectrum(self) -> dict[str, Any] | None:
        return await self._get("/api/v1/audio/spectrum")

    async def prompt_fragment(self) -> str:
        data = await self._get("/api/v1/audio/prompt")
        if not data:
            return ""
        return str(data.get("fragment") or "")

    async def federation_snapshot(self) -> dict[str, Any] | None:
        return await self._get("/api/v1/federation/snapshot")

    async def observe(
        self,
        *,
        belief: float | None = None,
        node_id: str = "lattice",
        session_id: str | None = None,
    ) -> LatticeObservation:
        security = await self.security_status()
        spectrum = await self.spectrum()
        federation = await self.federation_snapshot()
        fragment = await self.prompt_fragment()

        parts: list[str] = []
        sec_view = None
        if security:
            sec_view = {
                "mtls": bool(security.get("mtls")),
                "chatOpen": bool(security.get("chatOpen")),
                "requireQuorum": bool(security.get("requireQuorum")),
                "anomalyCount": int(
                    security.get("anomalyCount")
                    or (security.get("anomalies") or {}).get("count")
                    or 0
                ),
                "severity": security.get("severity")
                or (security.get("anomalies") or {}).get("severity")
                or "unknown",
            }
            parts.append(
                f"security: mtls={sec_view['mtls']} quorum={sec_view['requireQuorum']} "
                f"severity={sec_view['severity']} anomalies={sec_view['anomalyCount']}"
            )

        spec_view = None
        if spectrum or fragment:
            spec_view = {
                "fragment": (fragment or str((spectrum or {}).get("fragment") or ""))[:240] or None,
                "fundamental": (spectrum or {}).get("fundamental") or (spectrum or {}).get("f0"),
                "energy": (spectrum or {}).get("energy") or (spectrum or {}).get("rms"),
            }
            if spec_view["fragment"]:
                parts.append(f"spectrum: {spec_view['fragment']}")
            elif spec_view["fundamental"] is not None:
                parts.append(f"spectrum: f0={spec_view['fundamental']} energy={spec_view['energy']}")

        fed_view = None
        if federation:
            fed_view = {
                "peers": federation.get("peers") or federation.get("peerCount"),
                "lastDigest": federation.get("lastDigest") or federation.get("digest"),
                "publishedAt": federation.get("publishedAt"),
            }
            parts.append(
                f"federation: peers={fed_view['peers'] or '?'} "
                f"digest={str(fed_view['lastDigest'] or '')[:16]}"
            )

        if belief is not None:
            b = float(belief)
            t = b * (1.0 - b)
            parts.append(f"belief={b:.4f} tension={t:.4f}")

        return LatticeObservation(
            node_id=node_id,
            session_id=session_id,
            observation=" | ".join(parts) if parts else "lattice: no active sensors",
            belief=belief,
            security=sec_view,
            spectrum=spec_view,
            federation=fed_view,
            provisional=True,
            raw={
                "security": security,
                "spectrum": spectrum,
                "federation": federation,
            },
        )

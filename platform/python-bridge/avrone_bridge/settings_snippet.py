"""Optional settings keys for dual-plane integration.

Merge into AVRONE config.settings when deploying the Python stack
alongside the Node living-intermediate plane.
"""

from __future__ import annotations

import os


def lattice_env() -> dict[str, str | bool]:
    return {
        "CONTROL12_PLATFORM_URL": os.getenv("CONTROL12_PLATFORM_URL", "http://127.0.0.1:4400"),
        "CONTROL12_PLATFORM_TOKEN": os.getenv("CONTROL12_PLATFORM_TOKEN", ""),
        "AVRONE_STACK_URL": os.getenv("AVRONE_STACK_URL", "http://127.0.0.1:8000"),
        "LATTICE_OBSERVE_ON_ROUTE": os.getenv("LATTICE_OBSERVE_ON_ROUTE", "1") == "1",
        "CONTROL12_LATTICE_ROOT": os.getenv("CONTROL12_LATTICE_ROOT", "avrone-duekrey"),
    }

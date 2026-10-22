"""Safe provider handshake CLI; never prints credentials or endpoint URLs."""
from __future__ import annotations
import json
import sys
from .settings import get_settings
from .executor_client import probe_executor, ExecutorConnectionError

def main() -> int:
    settings = get_settings()
    live = settings.activation_mode == "live"
    if not settings.external_executor_configured(require_https=live):
        print(json.dumps({"ok": False, "reason": "External executor configuration is incomplete or unsafe.", "liveHttpsRequired": live}))
        return 2
    try:
        result = probe_executor(settings.executor_base_url, settings.executor_api_key, settings.executor_model, require_https=live)
    except (ExecutorConnectionError, ValueError) as exc:
        print(json.dumps({"ok": False, "reason": str(exc), "liveHttpsRequired": live}))
        return 2
    print(json.dumps({"ok": True, "modelAvailable": result["modelAvailable"], "liveHttpsRequired": live, "secretValuesDisplayed": False}))
    return 0

if __name__ == "__main__":
    sys.exit(main())

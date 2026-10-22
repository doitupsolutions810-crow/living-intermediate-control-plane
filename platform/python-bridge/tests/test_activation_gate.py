import json
import os
import sys
import tempfile
import types
import unittest
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

from avrone_stack.activation_gate import SCHEMA, REQUIRED_CHECKS, evaluate_activation
from avrone_stack.settings import Settings
from avrone_stack import settings as settings_module

_swarm_stub = types.ModuleType("avrone_stack.swarm")
_swarm_stub.swarm = types.SimpleNamespace()
sys.modules.setdefault("avrone_stack.swarm", _swarm_stub)
from avrone_stack.stdlib_server import Handler  # noqa: E402

NOW = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)


def valid_evidence():
    observed = (NOW - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
    return {
        "schema": SCHEMA,
        "environment": "production",
        "releaseSha": "a" * 40,
        "issuedAt": observed,
        "expiresAt": (NOW + timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
        "checks": {
            key: {"passed": True, "reference": "test-evidence:" + key, "observedAt": observed}
            for key in REQUIRED_CHECKS
        },
    }


class ActivationGateTests(unittest.TestCase):
    def test_preview_never_allows_live_execution(self):
        result = evaluate_activation("preview", valid_evidence(), now=NOW)
        self.assertEqual(result["decision"], "SAFE_PREVIEW")
        self.assertFalse(result["liveExecutionAllowed"])

    def test_live_missing_evidence_is_blocked(self):
        self.assertEqual(evaluate_activation("live", None, now=NOW, expected_release_sha="a" * 40)["decision"], "BLOCKED")

    def test_fresh_complete_evidence_allows_gate(self):
        result = evaluate_activation("live", valid_evidence(), now=NOW, expected_release_sha="a" * 40)
        self.assertEqual(result["decision"], "LIVE_APPROVED")
        self.assertTrue(result["liveExecutionAllowed"])

    def test_fresh_evidence_without_expected_deployment_sha_is_blocked(self):
        result = evaluate_activation("live", valid_evidence(), now=NOW)
        self.assertFalse(result["liveExecutionAllowed"])

    def test_expired_evidence_is_blocked(self):
        evidence = valid_evidence()
        evidence["expiresAt"] = (NOW - timedelta(seconds=1)).isoformat()
        self.assertFalse(evaluate_activation("live", evidence, now=NOW, expected_release_sha="a" * 40)["liveExecutionAllowed"])

    def test_failed_check_is_blocked(self):
        evidence = valid_evidence()
        evidence["checks"]["postgresIntegrationPassed"]["passed"] = False
        self.assertFalse(evaluate_activation("live", evidence, now=NOW)["liveExecutionAllowed"])

    def test_missing_reference_is_blocked(self):
        evidence = valid_evidence()
        evidence["checks"]["ciPassed"]["reference"] = ""
        self.assertFalse(evaluate_activation("live", evidence, now=NOW)["liveExecutionAllowed"])

    def test_evidence_for_different_release_is_blocked(self):
        evidence = valid_evidence()
        evidence["releaseSha"] = "b" * 40
        result = evaluate_activation("live", evidence, now=NOW, expected_release_sha="a" * 40)
        self.assertFalse(result["liveExecutionAllowed"])

    def test_naive_timestamp_is_blocked(self):
        evidence = valid_evidence()
        evidence["issuedAt"] = "2026-10-22T11:59:00"
        self.assertFalse(evaluate_activation("live", evidence, now=NOW)["liveExecutionAllowed"])

    def test_non_utc_timestamp_is_blocked(self):
        evidence = valid_evidence()
        evidence["issuedAt"] = "2026-10-22T13:59:00+02:00"
        self.assertFalse(evaluate_activation("live", evidence, now=NOW, expected_release_sha="a" * 40)["liveExecutionAllowed"])

    def test_utc_zero_offset_timestamp_is_allowed(self):
        evidence = valid_evidence()
        evidence["issuedAt"] = (NOW - timedelta(minutes=1)).isoformat()
        evidence["expiresAt"] = (NOW + timedelta(hours=1)).isoformat()
        evidence["checks"]["ciPassed"]["observedAt"] = (NOW - timedelta(minutes=1)).isoformat()
        result = evaluate_activation(
            "live", evidence, now=NOW, expected_release_sha="a" * 40
        )
        self.assertTrue(result["liveExecutionAllowed"])

    def test_settings_require_both_operator_flag_and_evidence(self):
        with patch.dict(os.environ, {
            "ALLOW_AGENT_EXECUTION": "true",
            "AVRONE_ACTIVATION_MODE": "live",
        }, clear=True):
            settings = Settings()
            with self.assertRaises(PermissionError):
                settings.require_execution_gate()

    def test_settings_accept_fresh_evidence_only_with_live_mode_and_flag(self):
        evidence = valid_evidence()
        current = datetime.now(timezone.utc)
        observed = (current - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
        evidence["issuedAt"] = observed
        evidence["expiresAt"] = (current + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
        for item in evidence["checks"].values():
            item["observedAt"] = observed
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", encoding="utf-8") as f:
            json.dump(evidence, f)
            f.flush()
            env = {
                "ALLOW_AGENT_EXECUTION": "true",
                "AVRONE_ACTIVATION_MODE": "live",
                "AVRONE_ACTIVATION_EVIDENCE_FILE": f.name,
                "AVRONE_RELEASE_SHA": "a" * 40,
                "AVRONE_EXECUTOR_BEARER_TOKEN": "inbound-" + "i" * 40,
                "AVRONE_EXTERNAL_EXECUTOR_URL": "https://executor.example/v1",
                "AVRONE_EXTERNAL_EXECUTOR_API_KEY": "upstream-" + "u" * 40,
                "AVRONE_EXTERNAL_EXECUTOR_MODEL": "test-model",
            }
            with patch.dict(os.environ, env, clear=True):
                settings = Settings()
                self.assertTrue(settings.execution_enabled())
                settings.require_execution_gate()

    def test_http_executor_endpoint_refuses_request_in_preview_even_if_flag_is_true(self):
        env = {
            "ALLOW_AGENT_EXECUTION": "true",
            "AVRONE_ACTIVATION_MODE": "preview",
            "AVRONE_ACTIVATION_EVIDENCE_FILE": "",
            "AVRONE_STACK_HOST": "127.0.0.1",
        }
        with patch.dict(os.environ, env, clear=True):
            settings_module._settings = Settings()
            server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                body = json.dumps({"messages": [{"role": "user", "content": "must not execute"}]}).encode()
                request = Request(
                    "http://127.0.0.1:" + str(server.server_port) + "/v1/chat/completions",
                    data=body,
                    headers={"content-type": "application/json"},
                    method="POST",
                )
                try:
                    with urlopen(request, timeout=2) as response:
                        self.fail("Expected activation gate denial, got HTTP " + str(response.status))
                except HTTPError as error:
                    self.assertEqual(error.code, 403)
                    payload = json.loads(error.read().decode())
                    self.assertIn("Activation gate is not approved", payload["error"])
                    self.assertFalse(payload["activation"]["liveExecutionAllowed"])
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)
                settings_module._settings = None

    def test_health_summary_does_not_expose_evidence_references(self):
        evidence = valid_evidence()
        current = datetime.now(timezone.utc)
        observed = (current - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
        evidence["issuedAt"] = observed
        evidence["expiresAt"] = (current + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
        for item in evidence["checks"].values():
            item["observedAt"] = observed
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", encoding="utf-8") as f:
            json.dump(evidence, f)
            f.flush()
            with patch.dict(os.environ, {
                "ALLOW_AGENT_EXECUTION": "true",
                "AVRONE_ACTIVATION_MODE": "live",
                "AVRONE_ACTIVATION_EVIDENCE_FILE": f.name,
                "AVRONE_RELEASE_SHA": "a" * 40,
                "AVRONE_EXECUTOR_BEARER_TOKEN": "inbound-" + "i" * 40,
                "AVRONE_EXTERNAL_EXECUTOR_URL": "https://executor.example/v1",
                "AVRONE_EXTERNAL_EXECUTOR_API_KEY": "upstream-" + "u" * 40,
                "AVRONE_EXTERNAL_EXECUTOR_MODEL": "test-model",
            }, clear=True):
                summary = Settings().activation_status()
            serialized = json.dumps(summary).lower()
            self.assertTrue(summary["liveExecutionAllowed"])
            self.assertNotIn("test-evidence", serialized)


if __name__ == "__main__":
    unittest.main()

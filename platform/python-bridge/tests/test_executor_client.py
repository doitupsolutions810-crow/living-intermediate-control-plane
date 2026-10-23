import json
import unittest
from urllib.error import HTTPError
from unittest.mock import patch
from urllib.request import Request
from avrone_stack.executor_client import ExecutorConnectionError, chat_completion, probe_executor, validate_executor_config

class FakeResponse:
    def __init__(self, value): self.raw = json.dumps(value).encode()
    def __enter__(self): return self
    def __exit__(self, *_args): return None
    def read(self, amount=-1): return self.raw if amount < 0 else self.raw[:amount]

class ExecutorClientTests(unittest.TestCase):
    def test_live_rejects_http_remote(self):
        with self.assertRaises(ValueError):
            validate_executor_config("http://executor.example/v1", "k" * 32, "model", require_https=True)

    def test_rejects_credentials_in_url(self):
        with self.assertRaises(ValueError):
            validate_executor_config("https://user:pass@executor.example/v1", "k" * 32, "model")

    def test_live_chat_uses_bearer_key_and_approved_model(self):
        response = {"model":"model-a","choices":[{"message":{"content":"connected"}}],
                    "usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}
        with patch("avrone_stack.executor_client._SAFE_OPENER.open", return_value=FakeResponse(response)) as open_call:
            result = chat_completion("https://executor.example/v1", "k" * 32, "model-a",
                                     [{"role":"user","content":"ping"}], require_https=True)
        request = open_call.call_args.args[0]
        self.assertIsInstance(request, Request)
        self.assertEqual(request.full_url, "https://executor.example/v1/chat/completions")
        self.assertEqual(request.get_header("Authorization"), "Bearer " + "k" * 32)
        self.assertEqual(json.loads(request.data)["model"], "model-a")
        self.assertEqual(result["content"], "connected")
        self.assertEqual(result["usage"]["total_tokens"], 5)

    def test_probe_requires_configured_model_to_be_listed(self):
        with patch("avrone_stack.executor_client._SAFE_OPENER.open", return_value=FakeResponse({"data":[{"id":"model-a"}]})):
            self.assertTrue(probe_executor("https://executor.example/v1", "k" * 32, "model-a")["ok"])
        with patch("avrone_stack.executor_client._SAFE_OPENER.open", return_value=FakeResponse({"data":[{"id":"other"}]})):
            with self.assertRaises(ExecutorConnectionError): probe_executor("https://executor.example/v1", "k" * 32, "model-a")

    def test_provider_redirect_is_not_followed(self):
        redirect=HTTPError("https://executor.example/v1/models",302,"redirect",{},None)
        with patch("avrone_stack.executor_client._SAFE_OPENER.open", side_effect=redirect) as open_call:
            with self.assertRaises(ExecutorConnectionError): probe_executor("https://executor.example/v1","k"*32,"model-a")
        self.assertEqual(open_call.call_count,1)

    def test_user_supplied_model_is_not_accepted_without_config(self):
        with self.assertRaises(ValueError): validate_executor_config("https://executor.example/v1","k"*32,"")

if __name__ == "__main__": unittest.main()

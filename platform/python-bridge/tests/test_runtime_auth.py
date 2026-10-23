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
from avrone_stack.activation_gate import SCHEMA, REQUIRED_CHECKS
from avrone_stack.settings import Settings
from avrone_stack import settings as settings_module

_swarm_stub = types.ModuleType("avrone_stack.swarm")
_swarm_stub.swarm = types.SimpleNamespace()
sys.modules.setdefault("avrone_stack.swarm", _swarm_stub)
from avrone_stack.stdlib_server import Handler  # noqa: E402

def valid_evidence(release_sha="a" * 40):
    now = datetime.now(timezone.utc)
    observed = (now - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
    return {"schema":SCHEMA,"environment":"production","releaseSha":release_sha,"issuedAt":observed,
            "expiresAt":(now+timedelta(hours=1)).isoformat().replace("+00:00","Z"),
            "checks":{key:{"passed":True,"reference":"verified:"+key,"observedAt":observed} for key in REQUIRED_CHECKS}}

def start_server(extra_env):
    evidence=valid_evidence()
    f=tempfile.NamedTemporaryFile(mode="w",suffix=".json",encoding="utf-8",delete=False)
    json.dump(evidence,f); f.close()
    env={"ALLOW_AGENT_EXECUTION":"true","AVRONE_ACTIVATION_MODE":"live",
         "AVRONE_ACTIVATION_EVIDENCE_FILE":f.name,"AVRONE_RELEASE_SHA":"a"*40,
         "AVRONE_EXECUTOR_BEARER_TOKEN":"inbound-token-"+"i"*32,
         "AVRONE_EXTERNAL_EXECUTOR_URL":"https://executor.example/v1",
         "AVRONE_EXTERNAL_EXECUTOR_API_KEY":"upstream-token-"+"u"*32,
         "AVRONE_EXTERNAL_EXECUTOR_MODEL":"approved-model","LATTICE_OBSERVE_ON_ROUTE":"0",
         "AVRONE_STACK_HOST":"127.0.0.1",**extra_env}
    return f.name,env

class RuntimeAuthTests(unittest.TestCase):
    def tearDown(self): settings_module._settings=None

    def test_live_needs_inbound_token_and_external_provider(self):
        evidence=valid_evidence()
        with tempfile.NamedTemporaryFile(mode="w",suffix=".json",encoding="utf-8") as f:
            json.dump(evidence,f); f.flush()
            with patch.dict(os.environ,{"ALLOW_AGENT_EXECUTION":"true","AVRONE_ACTIVATION_MODE":"live",
                    "AVRONE_ACTIVATION_EVIDENCE_FILE":f.name,"AVRONE_RELEASE_SHA":"a"*40},clear=True):
                settings=Settings()
                self.assertFalse(settings.execution_enabled())
                self.assertFalse(settings.activation_status()["liveExecutionAllowed"])
                with self.assertRaises(PermissionError): settings.require_execution_gate()

    def test_live_endpoint_rejects_missing_and_wrong_bearer_token(self):
        evidence_path,env=start_server({})
        with patch.dict(os.environ,env,clear=True):
            settings_module._settings=Settings()
            self.assertTrue(settings_module._settings.execution_enabled())
            server=ThreadingHTTPServer(("127.0.0.1",0),Handler); thread=Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                url=f"http://127.0.0.1:{server.server_port}/v1/chat/completions"
                body=json.dumps({"messages":[{"role":"user","content":"hello"}]}).encode()
                for authorization in (None,"Bearer wrong"):
                    headers={"content-type":"application/json"}
                    if authorization: headers["authorization"]=authorization
                    with self.assertRaises(HTTPError) as caught: urlopen(Request(url,data=body,headers=headers,method="POST"),timeout=2)
                    self.assertEqual(caught.exception.code,401)
                async def fake_route(**_kwargs):
                    return {"content":"provider result","model":"approved-model","routed_to":"general",
                            "usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2},
                            "session_id":"test","lattice":None,"evidence":{"toolsEnabled":False}}
                _swarm_stub.swarm.route=fake_route
                headers={"content-type":"application/json","authorization":"Bearer "+env["AVRONE_EXECUTOR_BEARER_TOKEN"]}
                response=urlopen(Request(url,data=body,headers=headers,method="POST"),timeout=2)
                payload=json.loads(response.read().decode())
                self.assertEqual(response.status,200)
                self.assertEqual(payload["choices"][0]["message"]["content"],"provider result")
                self.assertNotIn(env["AVRONE_EXECUTOR_BEARER_TOKEN"],json.dumps(payload))
                self.assertNotIn(env["AVRONE_EXTERNAL_EXECUTOR_API_KEY"],json.dumps(payload))
            finally:
                server.shutdown();server.server_close();thread.join(timeout=2);os.unlink(evidence_path)
                if hasattr(_swarm_stub.swarm,"route"): delattr(_swarm_stub.swarm,"route")

    def test_health_does_not_leak_credentials_or_allow_wildcard_cors(self):
        evidence_path,env=start_server({"AVRONE_ACTIVATION_MODE":"preview","ALLOW_AGENT_EXECUTION":"false"})
        with patch.dict(os.environ,env,clear=True):
            settings_module._settings=Settings()
            server=ThreadingHTTPServer(("127.0.0.1",0),Handler);thread=Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                response=urlopen(Request(f"http://127.0.0.1:{server.server_port}/health",headers={"Origin":"https://untrusted.example"}),timeout=2)
                body=response.read().decode()
                self.assertNotIn("access-control-allow-origin",[k.lower() for k in response.headers])
                self.assertNotIn(env["AVRONE_EXECUTOR_BEARER_TOKEN"],body)
                self.assertNotIn(env["AVRONE_EXTERNAL_EXECUTOR_API_KEY"],body)
                self.assertFalse(json.loads(body)["allow_agent_execution"])
            finally:
                server.shutdown();server.server_close();thread.join(timeout=2);os.unlink(evidence_path)

    def test_request_size_limit_is_enforced(self):
        evidence_path,env=start_server({})
        with patch.dict(os.environ,env,clear=True):
            settings_module._settings=Settings()
            server=ThreadingHTTPServer(("127.0.0.1",0),Handler);thread=Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                request=Request(f"http://127.0.0.1:{server.server_port}/v1/chat/completions",data=b"",
                    headers={"content-type":"application/json","authorization":"Bearer "+env["AVRONE_EXECUTOR_BEARER_TOKEN"],
                             "content-length":"1048577"},method="POST")
                with self.assertRaises(HTTPError) as caught: urlopen(request,timeout=2)
                self.assertEqual(caught.exception.code,413)
            finally:
                server.shutdown();server.server_close();thread.join(timeout=2);os.unlink(evidence_path)

if __name__ == "__main__": unittest.main()

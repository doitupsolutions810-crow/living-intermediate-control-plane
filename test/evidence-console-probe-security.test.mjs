import test from "node:test";
import assert from "node:assert/strict";
import { probeEvidenceConsole } from "../lib/evidence-console.mjs";

const statusUrl = "https://evidence.example.invalid/api/status";
const schemaUrl = "https://evidence.example.invalid/api/v1/evidence/schema";

function responseAt(url, body, init = {}) {
  const response = new Response(body, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) }
  });
  Object.defineProperty(response, "url", { value: url, configurable: true });
  return response;
}

function validPairFetch(log = []) {
  return async (input, init) => {
    const url = String(input);
    log.push({ url, init });
    return url === schemaUrl
      ? responseAt(url, JSON.stringify({ kind: "schema", revision: 7 }))
      : responseAt(url, JSON.stringify({ kind: "status", schemaRevision: 7 }));
  };
}

const verifyPair = async (document, schema) => ({
  valid: document.kind === "status" && schema.kind === "schema" &&
    document.schemaRevision === schema.revision,
  failures: []
});

test("non-HTTPS or credentialed source URLs are invalid and cannot downgrade to local fallback", async () => {
  let calls = 0;
  for (const url of [
    "http://evidence.example.invalid/api/status",
    "https://user:pass@evidence.example.invalid/api/status",
    "https://evidence.example.invalid/api/status#fragment",
    "https://evidence.example.invalid/api/status?token=unsafe"
  ]) {
    const result = await probeEvidenceConsole({
      url, acceptLocal: true,
      fetchImpl: async () => { calls++; throw new Error("must not fetch"); }
    });
    assert.equal(result.status, "invalid");
    assert.equal(result.authority, "public");
    assert.equal(result.trustContractVerified, false);
  }
  assert.equal(calls, 0);
});

test("redirect response from status endpoint is rejected as invalid rather than local outage", async () => {
  const result = await probeEvidenceConsole({
    url: statusUrl,
    acceptLocal: true,
    fetchImpl: async input => responseAt(String(input), "", {
      status: 302,
      headers: { location: "https://attacker.example.invalid/api/status" }
    })
  });
  assert.equal(result.status, "invalid");
  assert.equal(result.authority, "public");
  assert.equal(result.trustContractVerified, false);
  assert.equal(result.verificationFailures[0].code, "REDIRECT_REJECTED");
});

test("a final response URL that differs from the configured endpoint cannot receive trust", async () => {
  const result = await probeEvidenceConsole({
    url: statusUrl,
    acceptLocal: true,
    fetchImpl: async () => responseAt(
      "https://attacker.example.invalid/api/status",
      JSON.stringify({ kind: "status", schemaRevision: 7 })
    ),
    verifyDocument: verifyPair
  });
  assert.equal(result.status, "invalid");
  assert.equal(result.authority, "public");
  assert.equal(result.verificationFailures[0].code, "FINAL_URL_MISMATCH");
});

test("redirect at the schema endpoint is rejected without local fallback", async () => {
  const calls = [];
  const result = await probeEvidenceConsole({
    url: statusUrl,
    acceptLocal: true,
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push(url);
      return url === schemaUrl
        ? responseAt(url, "", { status: 307, headers: { location: "https://attacker.example.invalid/schema" } })
        : responseAt(url, JSON.stringify({ kind: "status", schemaRevision: 7 }));
    },
    verifyDocument: verifyPair
  });
  assert.deepEqual(calls, [statusUrl, schemaUrl]);
  assert.equal(result.status, "invalid");
  assert.equal(result.authority, "public");
  assert.equal(result.verificationFailures[0].code, "REDIRECT_REJECTED");
});

test("trusted probe pins exact endpoint URLs and disables redirects/cache on both requests", async () => {
  const log = [];
  const result = await probeEvidenceConsole({
    url: statusUrl,
    acceptLocal: true,
    fetchImpl: validPairFetch(log),
    verifyDocument: verifyPair
  });
  assert.equal(result.status, "ok");
  assert.equal(result.authority, "public");
  assert.equal(result.trustContractVerified, true);
  assert.deepEqual(log.map(item => item.url), [statusUrl, schemaUrl]);
  for (const item of log) {
    assert.equal(item.init.redirect, "manual");
    assert.equal(item.init.cache, "no-store");
    assert.equal(item.init.headers["cache-control"], "no-cache");
    assert.equal(item.init.headers.accept, "application/json");
    assert.ok(item.init.signal, "request must have a bounded timeout signal");
  }
});

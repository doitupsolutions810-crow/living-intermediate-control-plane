# AVRONE Activation Gate — plain-language operator guide

## What is enabled now?

SAFE PREVIEW ONLY. Health checks, review, and dry-run planning may run. Live calls stay blocked unless release evidence, executor connection, caller credential, and operator criteria all pass. The startup script defaults to preview and execution off.

## The eight green lights

1. Build and tests: the exact release has a successful CI result.
2. Real database test: PostgreSQL 16 integration ran against a disposable database and passed.
3. Tenant separation: one tenant cannot read, claim, or mutate another tenant's data.
4. Staging safety review: authentication, TLS, permissions, network exposure, and logs were reviewed.
5. Restore test: a backup was restored successfully, not just created.
6. Worker identity: credentials are active, scoped, and rotation was checked.
7. Executor health: the selected external model endpoint answered the health probe.
8. Human approval: an authorized operator approved the exact release for live use.

Every item must be marked passed, reference reviewable evidence, and be less than 24 hours old. The release identifier must exactly match the deployed release. Missing or stale evidence means NO-GO. A reference is not automatically verified just because it is present; the reviewer must inspect it.

## Connect the model service safely

This bridge accepts one operator-configured OpenAI-compatible HTTPS endpoint. It does not run arbitrary tools or external write actions.

Set these values in the deployment secret manager, never in source control or chat:

- AVRONE_EXTERNAL_EXECUTOR_URL: the provider's API base URL, normally ending in /v1.
- AVRONE_EXTERNAL_EXECUTOR_API_KEY: that provider's API key.
- AVRONE_EXTERNAL_EXECUTOR_MODEL: the approved model name.
- AVRONE_EXECUTOR_BEARER_TOKEN: a separate secret used by trusted callers to access AVRONE. Use at least 32 random characters.
- AVRONE_ALLOWED_ORIGIN: optional exact website origin if a browser is allowed to call the bridge. It is empty by default.

The provider key and AVRONE caller token are different credentials. Use TLS, rotate both through your secret manager, and choose a provider approved for the data being sent. The client refuses redirects so provider authorization is not forwarded to a different host.

From platform/python-bridge, run:

    python -m avrone_stack.executor_probe

The probe checks that the endpoint responds and lists the configured model. Its output never displays keys or the endpoint URL. A successful probe is necessary but not sufficient for production approval.

## Check readiness without starting workers

At the repository root, run:

    npm run activation:check

This is safe preview by default and must not start agents or write production data. To review a prepared evidence file:

    node status/activation-gate.mjs --mode live --evidence /secure/path/activation-evidence.json

The executor refuses requests unless all conditions hold:
- ALLOW_AGENT_EXECUTION=true
- AVRONE_ACTIVATION_MODE=live
- recent evidence passes all eight criteria for the exact AVRONE_RELEASE_SHA
- a valid inbound AVRONE_EXECUTOR_BEARER_TOKEN is configured and included as a bearer credential by the caller
- an approved external executor URL, API key, and model are configured; live mode requires HTTPS

Health reports configuration status only; it never returns credential values or evidence references. The bridge provides text completion only. Provider tool calls, shell commands, and production-write tools are not enabled.

## Current connections

| Connection | Confirmed state | What closes the gap |
|---|---|---|
| GitHub | Repository connection works; hosted Actions jobs have failed before any step ran | A complete green CI run for the exact release |
| PostgreSQL | No real test database is available in this work session | Connect a disposable PostgreSQL 16 database and run the actual integration suite |
| Hosting (Vercel) | Not connected to this work session | Connect the provider, verify the project and root directory, then deploy a preview |
| App editor (Replit) | Provider is installed, but app search found no AVRONE app | Open/authorize the intended app or identify the intended project; do not create a duplicate blindly |
| Evidence console | Prior documentation reported a public 404; no current live HTTP check was confirmed here | Verify a real response and schema, or keep local evidence clearly marked temporary |
| External model executor | Bridge supports a configured external OpenAI-compatible model, but no endpoint or key was provided here | Add endpoint/model/key in the secret manager, run the model probe, then record fresh evidence |
| Lattice/control-plane link | Optional observation client exists, but no production URL/token handshake is confirmed | Set the control-plane URL and token in the secret manager, then verify an expected security/status snapshot |

A service is connected only after a real handshake and safe test action, not because a file or environment variable exists.

## Rollback

If any criterion goes red, expires, or cannot be checked: keep preview mode, set ALLOW_AGENT_EXECUTION=false, stop the executor service, and revoke the suspect credential. Do not retry production writes until the cause is understood. Resume only with fresh evidence for the same release.

## Current decision

GO: safe preview, read-only health checks, activation review, and a test-only external-model probe.

NO-GO: live requests, autonomous workers, external write tools, or production budget mutations until the eight criteria pass, the actual database test completes, hosted CI works, and the exact release is approved.

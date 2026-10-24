# Great Scale — Levels 10901–10950: Self-Starting Verification Infrastructure

## Finding

The failed Platform verification jobs did not reach test execution: GitHub reported no runner allocation and zero steps. Repeated retries alone cannot resolve a missing execution host. The verification system therefore needs a runner lifecycle contract, not another retry loop.

## Runner lifecycle

1. **Host boot:** systemd starts the Great Scale supervisor after network and Docker.
2. **Registration:** the supervisor uses a host-only, root-protected PAT to request a short-lived repository registration token.
3. **Ephemeral worker:** Docker starts a single-job runner container with labels self-hosted, linux, x64, great-scale.
4. **Token scope:** the registration token is sent through container stdin, not recorded as a Docker environment variable; the entrypoint clears its shell variable before executing job processes.
5. **Single job:** the runner is configured with --ephemeral, so GitHub removes the registered runner after one job.
6. **Replenishment:** after the container exits, the supervisor waits briefly and requests a fresh registration token.
7. **Reboot recovery:** systemd is enabled for multi-user.target and restarts the supervisor after service failure or host reboot.

## Trust boundary

Pull-request jobs stay on GitHub-hosted runners. Only trusted branch pushes and manual dispatch select the self-hosted runner labels. The runner container does not mount the Docker socket, host home directory, or PAT file. Use a dedicated disposable VM because code executed by any self-hosted runner must be treated as untrusted relative to the host.

## Great Scale mapping

| Level | Invariant | Verification |
|---|---|---|
| 10901 | Host service starts after network and Docker | systemctl is-enabled great-scale-runner.service |
| 10902 | PAT never enters runner-container environment | Inspect supervisor and docker run arguments; token is piped to stdin |
| 10903 | Each container executes at most one job | Runner configured with --ephemeral and container is --rm |
| 10904 | Runner registration is renewed after exit | Supervisor loop requests a new token each cycle |
| 10905 | PR code does not use self-hosted infrastructure | Workflow routes pull_request to ubuntu-latest |
| 10906 | Bootstrap scripts parse before platform tests | CI runs bash -n over runner shell scripts |
| 10907 | Test/build/smoke evidence must come from executed steps | A queued runner or zero-step failure is not a test result |

## Operational boundary

The bootstrap code is committed, but a host is not provisioned by a repository commit. Install it on a dedicated Ubuntu/Debian x86_64 VM you control using .github/runner/install-ubuntu.sh, with a fine-grained PAT scoped to this repository and Administration: write. The installer enables the service at boot. Until the host is installed and registered, trusted push/manual workflow jobs will remain queued for the great-scale runner label.

The runner image and service have not been built or boot-tested in this chat environment. The next honest verification point is a successful host startup, a visible online runner in repository Settings, then a workflow run with real job steps.

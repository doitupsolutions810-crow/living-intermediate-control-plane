# Great Scale ephemeral self-hosted runner

This bootstrap creates a Docker-isolated, one-job GitHub Actions runner. A systemd supervisor starts at boot, requests a fresh repository runner-registration token, launches one ephemeral container, and repeats after the job exits. The long-lived PAT stays in a root-only host file and is not passed into the runner container.

## Requirements

- A dedicated Ubuntu 22.04/24.04 or compatible Debian x86_64 VM that you control.
- Outbound HTTPS access to api.github.com, github.com, and GitHub release assets.
- Repository access to register runners.
- A fine-grained PAT scoped only to this repository with **Administration: write** permission. It is stored at /etc/great-scale-runner/runner.env with root-only permissions. Never commit the PAT or place it in workflow logs.

## Install

From the repository root on the dedicated host, check out the trusted branch and run:

    sudo bash .github/runner/install-ubuntu.sh

The installer installs Docker, builds the runner image from the official GitHub Actions runner release, stores the PAT in a root-only environment file, and enables great-scale-runner.service at boot. The supervisor uses labels self-hosted, linux, x64, and great-scale.

Inspect startup and registration:

    sudo systemctl status great-scale-runner.service
    sudo journalctl -u great-scale-runner.service -f

Check the runner appears under the repository's Settings > Actions > Runners. The service will keep retrying registration if GitHub is unreachable or the PAT is missing required permissions.

## Security model

- Use a dedicated disposable VM; do not install on a personal workstation or a machine with production credentials.
- Runner containers are ephemeral and do not mount the Docker socket, host home directory, or PAT file.
- The PAT is used only by the host supervisor to mint short-lived registration tokens. The runner receives only the short-lived registration token and clears it before launching job processes.
- Pull-request jobs continue to use GitHub-hosted runners. Do not route untrusted fork pull requests onto self-hosted infrastructure.
- A self-hosted runner is still a code-execution boundary. Only use this setup for repositories and branches you trust, and rotate/revoke the PAT if the host is compromised.
- The image resolves the latest official runner release when built. Rebuild it periodically to receive runner updates.

## Troubleshooting

- Resource not accessible by personal access token: ensure the PAT has repository Administration: write.
- No runner appears: inspect the systemd journal, network egress, repository spelling, and PAT expiry.
- Job remains queued: confirm the runner is online and has all labels self-hosted, linux, x64, great-scale.
- Runner fails immediately: inspect the job logs and rebuild the image.

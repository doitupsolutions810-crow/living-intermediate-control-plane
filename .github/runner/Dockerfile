FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git jq tar gzip \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 runner
WORKDIR /home/runner
RUN set -eux; \
    VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -er '.tag_name | ltrimstr("v")')"; \
    curl -fsSL --retry 3 \
      "https://github.com/actions/runner/releases/download/v${VERSION}/actions-runner-linux-x64-${VERSION}.tar.gz" \
      -o /tmp/actions-runner.tar.gz; \
    tar -xzf /tmp/actions-runner.tar.gz -C /home/runner; \
    rm /tmp/actions-runner.tar.gz; \
    ./bin/installdependencies.sh; \
    chown -R runner:runner /home/runner
COPY entrypoint.sh /usr/local/bin/great-scale-runner-entrypoint
RUN chmod 0755 /usr/local/bin/great-scale-runner-entrypoint
USER runner
ENTRYPOINT ["/usr/local/bin/great-scale-runner-entrypoint"]

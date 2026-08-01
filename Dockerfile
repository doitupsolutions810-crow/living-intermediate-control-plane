# Living Intermediate Control Plane
# Strategy: cache-friendly prepare stage → minimal distroless runtime
#
# Layer caching notes:
# 1. Metadata (package.json, config.json) copied first — invalidates rarely
# 2. Source copied by area — small edits only bust related layers
# 3. Init runs in prepare — runtime stage stays thin and immutable
# 4. Final image is distroless (no shell, no package manager)

# ── Stage 1: prepare (build tooling allowed) ─────────────────────────
FROM node:20-bookworm-slim AS prepare

WORKDIR /app

# Layer: metadata only
COPY package.json config.json ./

# Layers: source by area (stable → more volatile)
COPY lib/ ./lib/
COPY lattice/ ./lattice/
COPY agents/ ./agents/
COPY launchdesk/ ./launchdesk/
COPY avrone/ ./avrone/
COPY attestation/ ./attestation/
COPY status/ ./status/
COPY test/ ./test/
COPY integrate.mjs ./

# No npm install — plane has zero production dependencies

RUN mkdir -p data \
  && node status/init.mjs \
  && chown -R 65532:65532 /app

# ── Stage 2: distroless runtime ──────────────────────────────────────
# nonroot uid 65532 — no shell, no apt, minimal attack surface
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime

WORKDIR /app

COPY --from=prepare --chown=65532:65532 /app /app

# Distroless node image entrypoint is already `node`
CMD ["status/doctor.mjs"]

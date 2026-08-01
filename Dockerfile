# Living Intermediate Control Plane
# Optimized layers: metadata first, source by area, non-root runtime

# ── Stage 1: prepare files ───────────────────────────────────────────
FROM node:20-alpine AS prepare

WORKDIR /app

# Only metadata in this layer (changes rarely)
COPY package.json config.json ./

# Source grouped by change frequency / area (better cache hits)
COPY lib/ ./lib/
COPY lattice/ ./lattice/
COPY agents/ ./agents/
COPY launchdesk/ ./launchdesk/
COPY avrone/ ./avrone/
COPY attestation/ ./attestation/
COPY status/ ./status/
COPY test/ ./test/
COPY integrate.mjs ./

# No npm dependencies are required for the plane today.
# Keep package.json for version/info only — skip install to shrink image.

RUN mkdir -p data \
  && node status/init.mjs \
  && chown -R node:node /app

# ── Stage 2: runtime ─────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy prepared tree as non-root ownership
COPY --from=prepare --chown=node:node /app /app

USER node

# Default: doctor diagnostics
CMD ["node", "status/doctor.mjs"]

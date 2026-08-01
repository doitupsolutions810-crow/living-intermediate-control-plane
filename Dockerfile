# Living Intermediate Control Plane
# Lightweight Node image for doctor / CI / operator commands

FROM node:20-alpine

WORKDIR /app

# Copy package metadata first (better layer caching)
COPY package.json ./

# No production npm dependencies required today; keep install step for future use
RUN npm install --omit=dev --ignore-scripts || true

# Copy the plane source
COPY . .

# Ensure data directory exists inside the image
RUN mkdir -p data && node status/init.mjs

# Default command: doctor diagnostics
CMD ["node", "status/doctor.mjs"]

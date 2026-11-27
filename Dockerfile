# Multi-stage build for minimal production image

# ---- Stage 1: deps ----
FROM node:26-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: builder ----
FROM node:26-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set a build-time placeholder; real path is set at runtime via env
ENV DATABASE_PATH=/data/scorecard.db
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Stage 3: runner ----
FROM node:26-slim AS runner
WORKDIR /app

# Debian security fixes published since the base image was built. npm, npx, corepack and yarn go:
# nothing is installed at runtime, and their bundled packages are what scanners most often flag.
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/* \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/data/scorecard.db

# The standalone output includes only what's needed
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Data volume for the SQLite database
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

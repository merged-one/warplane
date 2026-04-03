# ---------------------------------------------------------------------------
# Warplane — Multi-stage Docker build (Postgres-native)
# ---------------------------------------------------------------------------

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

# Copy workspace config first for dependency-layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/storage/package.json packages/storage/
COPY packages/ingest/package.json packages/ingest/
COPY packages/cli/package.json packages/cli/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install dependencies (cached unless lockfile or package.json changes)
RUN pnpm install --frozen-lockfile

# Copy source and build all packages + apps
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY apps/web/ apps/web/
COPY tsconfig.json tsconfig.base.json ./
RUN pnpm build

# Create a self-contained production deploy of the API server.
# pnpm deploy bundles workspace deps and hoists node_modules for ESM compat.
RUN pnpm --filter @warplane/api deploy --legacy /app/deploy --prod

# ---------------------------------------------------------------------------
# Stage 2: Production
# ---------------------------------------------------------------------------
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production PORT=3000

# Copy the self-contained API deployment (flat node_modules, no symlinks)
COPY --from=builder /app/deploy ./

# Web frontend (served by API via @fastify/static)
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Example config files (operator mounts or overrides at runtime)
COPY config/ config/

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "dist/index.js"]

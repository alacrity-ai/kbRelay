# kbRelay self-host image (v0.12.0). Multi-stage: build the SPA + the Node
# server bundle, then a slim runtime that carries only dist + SPA + migrations
# and the native SQLite client. One process serves API + SPA (same-origin).

# ── builder ───────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY . .
# --ignore-scripts skips native devDep builds (better-sqlite3 etc.) we don't need.
RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm --filter @kbrelay/web run build \
 && pnpm --filter @kbrelay/api run build:node

# ── runtime ───────────────────────────────────────────────────
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    SPA_DIR=/app/web \
    MIGRATIONS_DIR=/app/migrations \
    DATABASE_URL=file:/data/kbrelay.db
# Only the native SQLite client is needed at runtime (everything else is bundled).
# `type=module` so Node loads the ESM bundle correctly.
RUN npm init -y >/dev/null 2>&1 && npm pkg set type=module \
 && npm install @libsql/client@0.17.4 --omit=dev --no-audit --no-fund
COPY --from=builder /app/apps/api/dist-node ./dist-node
COPY --from=builder /app/apps/api/migrations ./migrations
COPY --from=builder /app/apps/web/dist ./web
RUN mkdir -p /data
EXPOSE 8080
# Apply migrations (idempotent) then start the server.
CMD ["sh", "-c", "node dist-node/migrate.js && node dist-node/server.js"]

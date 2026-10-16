FROM node:24.21.0-alpine AS builder

WORKDIR /repo
ENV TURBO_TELEMETRY_DISABLED=1

COPY package.json .
RUN corepack enable && \
    for i in 1 2 3; do \
      corepack prepare --activate && break; \
      echo "corepack prepare failed (attempt $i), retrying" >&2; sleep 5; \
    done; \
    pnpm --version

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@podbor/parts-backend^...
RUN pnpm --filter @podbor/parts-backend build
RUN pnpm deploy --filter @podbor/parts-backend --prod --legacy /prod

FROM node:24.21.0-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=4000

COPY --from=builder --chown=node:node /prod/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/apps/parts-backend/dist ./dist

USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/server.js"]

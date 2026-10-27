FROM node:24.21.0-alpine AS builder

WORKDIR /repo
ENV MEDUSA_DISABLE_TELEMETRY=1 TURBO_TELEMETRY_DISABLED=1

COPY package.json .
RUN corepack enable && \
    for i in 1 2 3; do \
      corepack prepare --activate && break; \
      echo "corepack prepare failed (attempt $i), retrying" >&2; sleep 5; \
    done; \
    pnpm --version

COPY . .
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgres://build@localhost/build JWT_SECRET=build COOKIE_SECRET=build \
    STORE_CORS=http://build ADMIN_CORS=http://build AUTH_CORS=http://build \
    pnpm --filter "@podbor/carlab-shop..." build
RUN pnpm deploy --filter @podbor/carlab-shop --prod --legacy /prod

FROM node:24.21.0-alpine

WORKDIR /server
ENV NODE_ENV=production MEDUSA_DISABLE_TELEMETRY=1 PORT=9000

COPY --from=builder --chown=node:node /prod/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/apps/carlab-shop/.medusa/server ./
COPY --from=builder --chown=node:node /repo/apps/carlab-shop/assets ./assets

RUN node -e "require('typesense'); require('zod')" \
  && ! node -e "require.resolve('ts-node')" 2>/dev/null

USER node
EXPOSE 9000
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:9000/health || exit 1

CMD ["node_modules/.bin/medusa", "start"]

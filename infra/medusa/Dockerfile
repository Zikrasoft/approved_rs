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
RUN pnpm turbo run build --filter=@podbor/medusa^...
RUN pnpm --filter @podbor/medusa build
RUN pnpm deploy --filter @podbor/medusa --prod --legacy /prod

FROM node:24.21.0-alpine

WORKDIR /server
ENV NODE_ENV=production MEDUSA_DISABLE_TELEMETRY=1 PORT=9000

COPY --from=builder --chown=node:node /prod/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/apps/medusa/.medusa/server ./

RUN node -e "require('@podbor/brands'); require('@podbor/shop-catalog'); require('@podbor/shop-catalog/browser'); require('@podbor/shop-catalog/order-hook'); require('@podbor/i18n/translate/core'); require('@podbor/i18n/section')" \
  && ! node -e "require.resolve('ts-node')" 2>/dev/null \
  && install -d -o node -g node static

USER node
EXPOSE 9000
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:9000/health/ready || exit 1

CMD ["node_modules/.bin/medusa", "start"]

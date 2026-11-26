FROM caddy:2.11.8-builder-alpine AS build
RUN xcaddy build v2.11.8 \
  --with github.com/caddyserver/cache-handler@v0.17.0 \
  --with github.com/darkweak/storages/simplefs/caddy@v0.0.23

FROM caddy:2.11.8-alpine
RUN apk add --no-cache curl
COPY --from=build /usr/bin/caddy /usr/bin/caddy
CMD ["sh", "-c", "find /cache -mindepth 1 -delete; exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]

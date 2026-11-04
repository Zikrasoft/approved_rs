#!/bin/sh
set -eu
cd "$(dirname -- "$0")"

password=$(sed -n 's/^CRAWLER_DB_PASSWORD=//p' .env)
if [ -z "$password" ]; then
  echo "CRAWLER_DB_PASSWORD is not set in .env: the crawler has no database role." >&2
  exit 0
fi
case $password in
*[!0-9a-f]*)
  echo "CRAWLER_DB_PASSWORD must be hex (openssl rand -hex 32)." >&2
  exit 1
  ;;
esac

echo "==> Crawler database role"
docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U carlab -d carlab <<SQL
select not exists (select from pg_roles where rolname = 'crawler') as missing \gset
\if :missing
create role crawler;
\endif
alter role crawler with login nosuperuser nocreatedb nocreaterole noinherit password '$password';
grant select, insert, update on crawl_run, crawl_page to crawler;
SQL

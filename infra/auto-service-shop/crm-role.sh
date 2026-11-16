#!/bin/sh
set -eu
cd "$(dirname -- "$0")"

password=$(sed -n 's/^CRM_DB_PASSWORD=//p' .env)
if [ -z "$password" ]; then
  echo "CRM_DB_PASSWORD is not set in .env: the sites have no CRM database." >&2
  exit 0
fi
case $password in
*[!0-9a-f]*)
  echo "CRM_DB_PASSWORD must be hex (openssl rand -hex 32)." >&2
  exit 1
  ;;
esac

echo "==> CRM database"
docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U carlab -d carlab <<SQL
select not exists (select from pg_roles where rolname = 'crm') as missing \gset
\if :missing
create role crm;
\endif
alter role crm with login nosuperuser nocreatedb nocreaterole noinherit password '$password';
select not exists (select from pg_database where datname = 'crm') as no_database \gset
\if :no_database
create database crm owner crm;
\endif
revoke all on database crm from public;
revoke connect on database carlab from public;
SQL

#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
pg=carlab-crm-role-test-$$
trap 'docker rm -f "$pg" >/dev/null 2>&1; rm -rf "$work"' EXIT
image=$(sed -n 's/^ *image: \(postgres:.*\)$/\1/p' "$here/docker-compose.yml")

docker run -d --name "$pg" -e POSTGRES_USER=carlab -e POSTGRES_DB=carlab -e POSTGRES_PASSWORD=owner "$image" >/dev/null
tries=0
until docker exec "$pg" pg_isready -h 127.0.0.1 -U carlab -d carlab >/dev/null 2>&1 || [ "$tries" -ge 60 ]; do
  tries=$((tries + 1))
  sleep 1
done
address=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$pg")
docker exec -i "$pg" psql -q -v ON_ERROR_STOP=1 -U carlab -d carlab <<'SQL'
create table crawl_run (site text primary key, status text);
create table crawl_page (site text, url text, body_key text, primary key (site, url));
create table product (id text primary key);
insert into product values ('prod_1');
SQL

mkdir "$work/host" "$work/bin"
cp "$here/crm-role.sh" "$here/crawler-role.sh" "$work/host/"
real_docker=$(command -v docker)
cat >"$work/bin/docker" <<STUB
#!/bin/sh
echo "\$*" >>"$work/log"
[ "\$1 \$2 \$3 \$4" = 'compose exec -T postgres' ] || exit 1
shift 4
exec "$real_docker" exec -i "$pg" "\$@"
STUB
chmod +x "$work/bin/docker"

failures=0
expect() {
  name=$1
  shift
  if "$@" >/dev/null 2>&1; then
    echo "ok - $name"
  else
    echo "not ok - $name"
    failures=$((failures + 1))
  fi
}
refuse() {
  name=$1
  shift
  if "$@" >/dev/null 2>&1; then
    echo "not ok - $name"
    failures=$((failures + 1))
  else
    echo "ok - $name"
  fi
}
setup() {
  printf 'POSTGRES_PASSWORD=owner\nCRM_DB_PASSWORD=%s\nCRAWLER_DB_PASSWORD=c0ffee\n' "$1" >"$work/host/.env"
  PATH="$work/bin:$PATH" "$work/host/$2" >"$work/out" 2>&1
}
as_crm() {
  docker exec -e PGPASSWORD="$1" "$pg" psql -v ON_ERROR_STOP=1 -h "$address" -U crm -d "$2" -tAc "$3"
}
as_crawler() {
  docker exec -e PGPASSWORD=c0ffee "$pg" psql -v ON_ERROR_STOP=1 -h "$address" -U crawler -d carlab -tAc "$1"
}

expect 'setup creates the role and the database' setup 0a1b2c crm-role.sh
expect 'the crm role creates its tables' as_crm 0a1b2c crm 'create table leads (id uuid primary key)'
expect 'the crm role writes its tables' as_crm 0a1b2c crm "insert into leads values (gen_random_uuid())"
refuse 'the crm role cannot reach the shop database' as_crm 0a1b2c carlab 'select 1'
refuse 'the crm role cannot create a database' as_crm 0a1b2c crm 'create database other'
refuse 'the crm role cannot create a role' as_crm 0a1b2c crm 'create role other'
refuse 'the password never reaches a command line' grep -q 0a1b2c "$work/log"
refuse 'setup prints no password' grep -q 0a1b2c "$work/out"

expect 'the crawler role is set up after the crm role' setup 0a1b2c crawler-role.sh
expect 'the crawler still reaches the shop database' as_crawler 'select count(*) from crawl_run'
expect 'a rerun keeps the crawler connected' setup 0a1b2c crm-role.sh
expect 'the crawler still connects after a rerun' as_crawler 'select 1'

expect 'a rerun with a new password succeeds' setup 3d4e5f crm-role.sh
refuse 'the old password stops working' as_crm 0a1b2c crm 'select 1'
expect 'a rerun keeps the data' as_crm 3d4e5f crm 'select count(*) from leads'

refuse 'a password that is not hex is refused' setup "x'; drop database crm; --" crm-role.sh
expect 'a refused password keeps the role it had' as_crm 3d4e5f crm 'select 1'

: >"$work/log"
expect 'setup without a password succeeds' setup '' crm-role.sh
expect 'setup without a password says the sites have no CRM database' grep -q 'CRM_DB_PASSWORD is not set' "$work/out"
refuse 'setup without a password never reaches docker' test -s "$work/log"

[ "$failures" -eq 0 ]

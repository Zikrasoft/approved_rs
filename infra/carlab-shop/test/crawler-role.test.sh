#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
pg=carlab-crawler-role-test-$$
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
insert into crawl_run values ('mann-filter', 'running');
insert into crawl_page values ('mann-filter', 'https://a.test/', null);
insert into product values ('prod_1');
SQL

mkdir "$work/host" "$work/bin"
cp "$here/crawler-role.sh" "$work/host/"
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
  printf 'POSTGRES_PASSWORD=owner\nCRAWLER_DB_PASSWORD=%s\n' "$1" >"$work/host/.env"
  PATH="$work/bin:$PATH" "$work/host/crawler-role.sh" >"$work/out" 2>&1
}
as_crawler() {
  docker exec -e PGPASSWORD="$1" "$pg" psql -v ON_ERROR_STOP=1 -h "$address" -U crawler -d carlab -tAc "$2"
}

expect 'setup creates the role' setup 0a1b2c
expect 'the crawler reads the queue' as_crawler 0a1b2c 'select count(*) from crawl_run, crawl_page'
expect 'the crawler queues a run' as_crawler 0a1b2c "insert into crawl_run values ('varta', 'queued')"
expect 'the crawler stores a page' as_crawler 0a1b2c "update crawl_page set body_key = 'k' where site = 'mann-filter'"
expect 'the crawler adds a page' as_crawler 0a1b2c "insert into crawl_page values ('varta', 'https://b.test/', null)"
refuse 'the crawler cannot read the catalogue' as_crawler 0a1b2c 'select * from product'
refuse 'the crawler cannot write the catalogue' as_crawler 0a1b2c "insert into product values ('prod_2')"
refuse 'the crawler cannot delete crawled pages' as_crawler 0a1b2c 'delete from crawl_page'
refuse 'the crawler cannot drop a crawl table' as_crawler 0a1b2c 'drop table crawl_page'
refuse 'the crawler cannot create a table' as_crawler 0a1b2c 'create table mine (id int)'
refuse 'the crawler cannot create a role' as_crawler 0a1b2c 'create role other'
refuse 'the password never reaches a command line' grep -q 0a1b2c "$work/log"
refuse 'setup prints no password' grep -q 0a1b2c "$work/out"

expect 'a rerun with a new password succeeds' setup 3d4e5f
refuse 'the old password stops working' as_crawler 0a1b2c 'select 1'
expect 'the new password works' as_crawler 3d4e5f 'select count(*) from crawl_page'

refuse 'a password that is not hex is refused' setup "x'; drop table product; --"
expect 'a refused password touches nothing' docker exec "$pg" psql -U carlab -d carlab -tAc 'select * from product'
expect 'a refused password keeps the role it had' as_crawler 3d4e5f 'select 1'

: >"$work/log"
expect 'setup without a password succeeds' setup ''
expect 'setup without a password says the crawler has no role' grep -q 'CRAWLER_DB_PASSWORD is not set' "$work/out"
refuse 'setup without a password never reaches docker' test -s "$work/log"

[ "$failures" -eq 0 ]

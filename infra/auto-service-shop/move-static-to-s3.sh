#!/bin/sh
set -eu
umask 077
cd "$(dirname -- "$0")"

value() { sed -n "s/^$1=//p" .env | tail -n 1; }

bucket=$(value S3_PUBLIC_BUCKET)
file_url=$(value FILE_URL)
endpoint=$(value S3_ENDPOINT)
api_host=$(value API_HOST)
old_url=https://${api_host:-api.carlab.rs}/static
volume=${STATIC_VOLUME:-carlab_static}

[ -n "$bucket" ] && [ -n "$file_url" ] || {
  echo "Set S3_PUBLIC_BUCKET and FILE_URL in .env first." >&2
  exit 2
}
docker volume inspect "$volume" >/dev/null 2>&1 || {
  echo "There is no $volume volume: nothing to move." >&2
  exit 2
}

creds=$(mktemp "${TMPDIR:-/tmp}/carlab-s3.XXXXXX")
trap 'rm -f "$creds"' EXIT
sed -nE 's/^S3_(REGION|ACCESS_KEY_ID|SECRET_ACCESS_KEY)=/AWS_\1=/p' .env >"$creds"

echo "==> Files from the $volume volume to s3://$bucket"
docker run --rm --env-file "$creds" -v "$volume:/static:ro" amazon/aws-cli:2.38.6 \
  s3 sync /static "s3://$bucket" --only-show-errors ${endpoint:+--endpoint-url "$endpoint"}

echo "==> Image URLs from $old_url to $file_url"
docker compose exec -T postgres psql -U carlab -d carlab -v ON_ERROR_STOP=1 \
  -v old="$old_url" -v new="$file_url" <<'SQL'
update part_identifier set images = replace(images::text, :'old', :'new')::jsonb
  where strpos(images::text, :'old') > 0;
update category set image = replace(image::text, :'old', :'new')::jsonb
  where strpos(image::text, :'old') > 0;
SQL

echo "Moved. Once the shop shows its images from S3: docker volume rm $volume"

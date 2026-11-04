#!/bin/zsh
set -eu
umask 077
cd "${0:A:h}"

if [[ -z $(terraform output -raw public_bucket) ]]; then
  print -u2 "No outputs in the state: run terraform apply here first."
  exit 1
fi

out=${1:-rendered}
mkdir -p "$out"

write_env() {
  local file=$out/$1
  shift
  local name output value
  local -a names
  : >"$file"
  chmod 600 "$file"
  for name output in "$@"; do
    value=$(terraform output -raw "$output")
    print -r -- "$name=$value" >>"$file"
    names+=$name
  done
  print "${file:A}: ${(j:, :)names}"
}

write_env shop.env \
  FILE_URL file_url \
  S3_ENDPOINT s3_endpoint \
  S3_REGION s3_region \
  S3_ACCESS_KEY_ID shop_access_key_id \
  S3_SECRET_ACCESS_KEY shop_secret_access_key \
  S3_PUBLIC_BUCKET public_bucket \
  S3_PRIVATE_BUCKET private_bucket

write_env crawler.env \
  S3_ENDPOINT s3_endpoint \
  S3_REGION s3_region \
  S3_ACCESS_KEY_ID crawler_access_key_id \
  S3_SECRET_ACCESS_KEY crawler_secret_access_key \
  S3_PUBLIC_BUCKET public_bucket \
  S3_PRIVATE_BUCKET private_bucket

write_env backup.env \
  BACKUP_S3_ENDPOINT backup_endpoint \
  BACKUP_S3_REGION backup_region \
  BACKUP_S3_BUCKET backup_bucket \
  BACKUP_S3_ACCESS_KEY_ID backup_access_key_id \
  BACKUP_S3_SECRET_ACCESS_KEY backup_secret_access_key

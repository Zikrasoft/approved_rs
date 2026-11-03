locals {
  ipv4 = aws_lightsail_static_ip.shop.ip_address
}

output "ipv4" {
  value = local.ipv4
}

output "ipv6" {
  value = aws_lightsail_instance.shop.ipv6_addresses[0]
}

output "ssh_ubuntu" {
  value = "ssh ubuntu@${local.ipv4}"
}

output "ssh_deploy" {
  value = "ssh deploy@${local.ipv4}"
}

output "s3_region" {
  value = var.region
}

output "s3_endpoint" {
  value = ""
}

output "file_url" {
  value = "https://${aws_s3_bucket.public.bucket}.s3.${var.region}.amazonaws.com"
}

output "public_bucket" {
  value = aws_s3_bucket.public.bucket
}

output "private_bucket" {
  value = aws_s3_bucket.private.bucket
}

output "backup_bucket" {
  value = aws_s3_bucket.backup.bucket
}

output "backup_region" {
  value = var.backup_region
}

output "backup_endpoint" {
  value = "https://s3.${var.backup_region}.amazonaws.com"
}

output "shop_access_key_id" {
  value     = aws_iam_access_key.shop.id
  sensitive = true
}

output "shop_secret_access_key" {
  value     = aws_iam_access_key.shop.secret
  sensitive = true
}

output "crawler_access_key_id" {
  value     = aws_iam_access_key.crawler.id
  sensitive = true
}

output "crawler_secret_access_key" {
  value     = aws_iam_access_key.crawler.secret
  sensitive = true
}

output "backup_access_key_id" {
  value     = aws_iam_access_key.backup.id
  sensitive = true
}

output "backup_secret_access_key" {
  value     = aws_iam_access_key.backup.secret
  sensitive = true
}

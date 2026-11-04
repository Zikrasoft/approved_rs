resource "aws_s3_bucket" "backup" {
  provider = aws.backup
  bucket   = var.backup_bucket
}

resource "aws_s3_bucket_ownership_controls" "backup" {
  provider = aws.backup
  bucket   = aws_s3_bucket.backup.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "backup" {
  provider                = aws.backup
  bucket                  = aws_s3_bucket.backup.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_iam_user" "backup" {
  name = "carlab-backup"
}

resource "aws_iam_user_policy" "backup" {
  name = "carlab-backup-bucket"
  user = aws_iam_user.backup.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:AbortMultipartUpload"]
        Resource = "${aws_s3_bucket.backup.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.backup.arn
      },
    ]
  })
}

resource "aws_iam_access_key" "backup" {
  user = aws_iam_user.backup.name
}

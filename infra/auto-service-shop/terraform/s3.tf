resource "aws_s3_bucket" "public" {
  bucket = var.public_bucket
}

resource "aws_s3_bucket" "private" {
  bucket = var.private_bucket
}

resource "aws_s3_bucket_ownership_controls" "public" {
  bucket = aws_s3_bucket.public.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_ownership_controls" "private" {
  bucket = aws_s3_bucket.private.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "public" {
  bucket                  = aws_s3_bucket.public.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_public_access_block" "private" {
  bucket                  = aws_s3_bucket.private.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "public_read" {
  bucket     = aws_s3_bucket.public.id
  depends_on = [aws_s3_bucket_public_access_block.public]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.public.arn}/*"
    }]
  })
}

resource "aws_s3_bucket_versioning" "public" {
  bucket = aws_s3_bucket.public.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "public" {
  bucket     = aws_s3_bucket.public.id
  depends_on = [aws_s3_bucket_versioning.public]

  rule {
    id     = "expire-noncurrent"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    expiration {
      expired_object_delete_marker = true
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_iam_user" "shop" {
  name = "carlab-shop"
}

resource "aws_iam_user_policy" "shop" {
  name = "carlab-shop-buckets"
  user = aws_iam_user.shop.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.public.arn}/*", "${aws_s3_bucket.private.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = [aws_s3_bucket.public.arn, aws_s3_bucket.private.arn]
      },
    ]
  })
}

resource "aws_iam_access_key" "shop" {
  user = aws_iam_user.shop.name
}

resource "aws_iam_user" "crawler" {
  name = "carlab-crawler"
}

resource "aws_iam_user_policy" "crawler" {
  name = "carlab-crawler-private-bucket"
  user = aws_iam_user.crawler.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.private.arn}/crawl/*"
      },
      {
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = aws_s3_bucket.private.arn
        Condition = { StringLike = { "s3:prefix" = "crawl/*" } }
      },
    ]
  })
}

resource "aws_iam_access_key" "crawler" {
  user = aws_iam_user.crawler.name
}

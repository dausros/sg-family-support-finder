# One-off bootstrap for the remote-state backend: an S3 bucket (versioned,
# encrypted, private, TLS-only) and a DynamoDB lock table. Apply once per
# account with local state, then uncomment the backend "s3" block in
# ../versions.tf and run `terraform init -migrate-state` there.
#
# Terraform >= 1.10 can lock with S3 alone (use_lockfile = true); the
# DynamoDB table keeps compatibility with older CLIs and CI images.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  description = "Region for the state bucket and lock table."
  type        = string
  default     = "ap-southeast-1"
}

variable "state_bucket_name" {
  description = "Globally unique bucket name, e.g. sgfsf-o11-tfstate-<account-id>."
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB lock table name."
  type        = string
  default     = "sgfsf-o11-tflock"
}

resource "aws_s3_bucket" "state" {
  #checkov:skip=CKV_AWS_18:Access logging for the state bucket is left to the account's CloudTrail data events.
  #checkov:skip=CKV2_AWS_62:No consumer of S3 event notifications for state.
  #checkov:skip=CKV_AWS_144:Single-region reference; versioning protects state history.
  bucket = var.state_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Keep old state versions for 90 days, then expire them; clean up failed uploads.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

resource "aws_dynamodb_table" "lock" {
  #checkov:skip=CKV_AWS_119:The lock table holds only lock IDs and digests; encryption at rest with the AWS-owned key is enough.
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}

output "state_bucket" {
  description = "Bucket for the backend block."
  value       = aws_s3_bucket.state.id
}

output "lock_table" {
  description = "Lock table for the backend block."
  value       = aws_dynamodb_table.lock.name
}

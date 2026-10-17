terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # ---------------------------------------------------------------------------
  # Remote state (OPTIONAL — recommended for any shared use).
  #
  # 1. Create the bucket + lock table once with ./bootstrap (see README).
  # 2. Uncomment this block, fill in the names, then run:
  #      terraform init -migrate-state
  #
  # Local state is the default so `terraform init -backend=false` and
  # `terraform validate` work in CI without AWS credentials.
  # ---------------------------------------------------------------------------
  # backend "s3" {
  #   bucket         = "sgfsf-o11-tfstate-<account-id>"
  #   key            = "o11-platform/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   dynamodb_table = "sgfsf-o11-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = merge(
      {
        Project   = var.project
        ManagedBy = "terraform"
        Purpose   = "o11-reference-architecture"
      },
      var.extra_tags
    )
  }
}

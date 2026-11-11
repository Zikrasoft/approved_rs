terraform {
  required_version = "1.16.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.71.0"
    }
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "2.106.0"
    }
  }
}

provider "aws" {
  profile = var.aws_profile
  region  = var.region
}

provider "aws" {
  alias   = "backup"
  profile = var.aws_profile
  region  = var.backup_region
}

provider "digitalocean" {}

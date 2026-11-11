variable "aws_profile" {
  type    = string
  default = "carlab"
}

variable "region" {
  type    = string
  default = "eu-north-1"
}

variable "do_region" {
  type    = string
  default = "fra1"
}

variable "backup_region" {
  type    = string
  default = "eu-north-1"
}

variable "public_key_path" {
  type    = string
  default = "~/.ssh/id_rsa.pub"
}

variable "public_bucket" {
  type = string
}

variable "private_bucket" {
  type = string
}

variable "backup_bucket" {
  type = string
}

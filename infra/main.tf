provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"

}

terraform {
  required_version = ">=1.4.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~>5.31.0"
    }
  }

  backend "s3" {
    bucket               = "com-all-bucket-terraform-state-algebananazzzzz"
    key                  = "algebananazzzzz-site.tfstate"
    workspace_key_prefix = "tf-state"
    region               = "ap-southeast-1"
  }
}

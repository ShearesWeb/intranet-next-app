terraform {
  required_version = ">= 1.14"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # State in R2. Per-env settings (key, endpoint, creds) come from backend.tfbackend
  # plus env vars: terraform init -backend-config=backend.tfbackend
  backend "s3" {}
}

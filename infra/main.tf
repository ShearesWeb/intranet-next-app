data "cloudflare_zone" "main" {
  filter = {
    name = var.zone_name
  }
}

# R2 bucket backing the OpenNext incremental cache for this environment. wrangler
# binds it by name (NEXT_INC_CACHE_R2_BUCKET); Terraform owns its lifecycle.
resource "cloudflare_r2_bucket" "cache" {
  account_id    = var.cloudflare_account_id
  name          = local.r2_cache_bucket_name
  location      = var.r2_location
  storage_class = "Standard"
}

# Custom domain routing this environment's hostname to its Worker. Gated behind
# enable_custom_domains: the Worker must be deployed first (wrangler creates the
# script), then a second apply with enable_custom_domains = true attaches the domain.
resource "cloudflare_workers_custom_domain" "app" {
  count = var.enable_custom_domains ? 1 : 0

  account_id = var.cloudflare_account_id
  zone_id    = data.cloudflare_zone.main.id
  hostname   = var.custom_domain
  service    = var.worker_service
}

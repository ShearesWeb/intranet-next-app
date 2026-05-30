output "environment" {
  description = "Active environment."
  value       = var.env
}

output "r2_cache_bucket_name" {
  description = "R2 incremental-cache bucket name for this environment (bound in wrangler.jsonc)."
  value       = cloudflare_r2_bucket.cache.name
}

output "workers_custom_domain_cert_id" {
  description = "TLS certificate ID for the attached custom domain, or null when not enabled."
  value       = var.enable_custom_domains ? cloudflare_workers_custom_domain.app[0].cert_id : null
}

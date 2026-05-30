variable "cloudflare_account_id" {
  description = "Cloudflare account identifier. Supply via TF_VAR_cloudflare_account_id."
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token (Workers Scripts, Workers R2 Storage, Zone:Read). Supply via TF_VAR_cloudflare_api_token."
  type        = string
  sensitive   = true
}

variable "custom_domain" {
  description = "Public hostname routed to this environment's Worker (e.g. intranet.shweb.org)."
  type        = string
}

variable "enable_custom_domains" {
  description = <<-EOT
    Whether to attach the Worker custom domain. The target Worker must already be
    deployed (npm run deploy / deploy:preprod) before this is true, because
    cloudflare_workers_custom_domain references the Worker by its service name.
  EOT
  type        = bool
  default     = false
}

variable "env" {
  description = "Deployment environment; the leading segment of every resource name."
  type        = string

  validation {
    condition     = contains(["preprod", "prd"], var.env)
    error_message = "env must be either 'preprod' or 'prd'."
  }
}

variable "project_name" {
  description = "Application name used as the suffix in the {workspace}-web-{resource}-{name} convention."
  type        = string
}

variable "r2_location" {
  description = "R2 bucket location hint. 'apac' is closest to the shweb.org audience."
  type        = string
  default     = "apac"

  validation {
    condition     = contains(["apac", "eeur", "enam", "weur", "wnam", "oc"], var.r2_location)
    error_message = "r2_location must be one of: apac, eeur, enam, weur, wnam, oc."
  }
}

variable "worker_service" {
  description = "Name of the deployed Worker (wrangler) this environment's domain routes to."
  type        = string
}

variable "zone_name" {
  description = "Cloudflare DNS zone name containing the custom domain."
  type        = string
  default     = "shweb.org"
}

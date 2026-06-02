locals {
  # Resource naming convention: {env}-web-{resource}-{project}
  # e.g. prd-web-cache-intranet-web, preprod-web-cache-intranet-web
  r2_cache_bucket_name = "${var.env}-web-cache-${var.project_name}"
}

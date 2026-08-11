env            = "prd"
project_name   = "intranet-web"
custom_domain  = "intranet.shweb.org"
worker_service = "intranet"

# Flip to true only after the Worker has been deployed at least once.
# Worker "intranet" first deployed successfully at v2.3.14.
enable_custom_domains = true

# Cloudflare infrastructure (Terraform)

Provisions the Cloudflare resources for the intranet app's OpenNext/Workers deployment.
The module is **parameterized by `var.env`** (`preprod` | `prd`) and applied **once per
environment**, each with its own R2-backed state.

**Naming convention:** `{env}-web-<resource>-<project>`, project = `intranet-web`.
- R2 cache bucket → `prd-web-cache-intranet-web` / `preprod-web-cache-intranet-web` (mirrored in `wrangler.jsonc`)
- State key       → `<env>/intranet-web/terraform.tfstate` in the shared state bucket

**Managed here:** R2 incremental-cache bucket + Worker custom domain (zone resolved from
`zone_name` via a data source). The Worker scripts themselves are built/deployed by **wrangler**
(`npm run deploy` / `npm run deploy:preprod`); Terraform references the Worker by service name.

## Layout

```
infra/
├── terraform.tf      # versions + R2 (s3) backend (partial)
├── providers.tf      # cloudflare provider (api_token = var.cloudflare_api_token)
├── variables.tf
├── locals.tf         # name convention
├── main.tf           # zone data source + r2 bucket + custom domain
├── outputs.tf
└── config/
    ├── prd.tfvars        prd.tfbackend        # per-env values + state key (prd/…)
    └── preprod.tfvars    preprod.tfbackend    # per-env values + state key (preprod/…)
```

## Secrets & account identifiers — all via environment variables, never committed

```bash
export TF_VAR_cloudflare_account_id=...        # Cloudflare account id
export TF_VAR_cloudflare_api_token=...          # Workers Scripts + R2 + Zone:Read
# R2 state backend (S3-compatible):
export AWS_ACCESS_KEY_ID=...                     # R2 API token access key
export AWS_SECRET_ACCESS_KEY=...                 # R2 API token secret
export AWS_ENDPOINT_URL_S3="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
```

The `.tf` files, `config/*.tfvars`, and `config/*.tfbackend` contain **no** account id and **no**
secrets — safe to commit. `zone_name` defaults to `shweb.org`.

## Usage (per environment, e.g. prd)

```bash
cd infra
terraform init -backend-config=config/prd.tfbackend

# Phase 1 — create the R2 cache bucket (enable_custom_domains defaults to false)
terraform apply -var-file=config/prd.tfvars

# Phase 2 — deploy the Worker so the service exists (from repo root):
#   npm run deploy            # prd  (worker "intranet")
#   npm run deploy:preprod    # preprod (worker "intranet-preprod")
# ...then attach the custom domain:
terraform apply -var-file=config/prd.tfvars -var enable_custom_domains=true
```

To switch environments, re-init against the other backend (state key differs, so use
`-reconfigure`) and use the matching var-file:

```bash
terraform init -reconfigure -backend-config=config/preprod.tfbackend
terraform apply -var-file=config/preprod.tfvars
```

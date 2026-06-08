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

## CI/CD

The deploy workflows run this same `init` + `apply` **before** the Worker deploy, so the
R2 cache bucket exists when wrangler binds it:

- `.github/workflows/3-preprod-deploy.yaml` → `preprod.tfbackend` / `preprod.tfvars`, then `npm run deploy:preprod`
- `.github/workflows/4-prd-deploy.yaml` → `prd.tfbackend` / `prd.tfvars`, then `npm run deploy:prd`

The env vars above are backed by these **GitHub Actions secrets** (set on the `preprod` and
`prd` environments):

| Env var in CI | GitHub secret |
|---|---|
| `TF_VAR_cloudflare_account_id` + `CLOUDFLARE_ACCOUNT_ID` | `CLOUDFLARE_ACCOUNT_ID` |
| `TF_VAR_cloudflare_api_token` + `CLOUDFLARE_API_TOKEN` | `CLOUDFLARE_API_TOKEN` |
| `AWS_ACCESS_KEY_ID` | `R2_ACCESS_KEY_ID` |
| `AWS_SECRET_ACCESS_KEY` | `R2_SECRET_ACCESS_KEY` |
| `NEXT_PUBLIC_SUPABASE_URL` / `…PUBLISHABLE_DEFAULT_KEY` | same names (build-time) |

`AWS_ENDPOINT_URL_S3` is derived in-workflow from `CLOUDFLARE_ACCOUNT_ID`.

**Bootstrap order (one-time, per env):** custom domains stay off (`enable_custom_domains = false`
in the tfvars) until the Worker has been deployed at least once — CI's pre-deploy `apply` only
creates the R2 bucket. After the first successful deploy, flip the tfvars flag to `true` so the
next CI run attaches `intranet-beta.shweb.org` / `intranet.shweb.org`.

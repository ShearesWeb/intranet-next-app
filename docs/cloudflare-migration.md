# Migrating from SST/AWS to Cloudflare Workers (OpenNext)

Migrate this Next.js 15 app from `sst.aws.Nextjs` (Lambda + CloudFront + S3) to
**Cloudflare Workers** using the [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
adapter. Cloudflare resources are provisioned with **Terraform**; the Worker itself
is built and deployed with **wrangler** (driven by the OpenNext CLI).

> Both stacks use OpenNext under the hood — the AWS `sst.aws.Nextjs` construct already
> runs OpenNext for AWS. We're swapping the OpenNext *target* from AWS to Cloudflare.

---

## 0. Why this app is an easy migration

Findings from auditing the current code (these shape every decision below):

| Finding | Consequence for migration |
|---|---|
| **No `runtime = "edge"` anywhere** — all routes use the Node runtime | OpenNext-on-Workers wants Node runtime. Nothing to convert. |
| **Every API route is `force-dynamic` / `revalidate = 0`; no `generateStaticParams`, no `revalidateTag`/`revalidatePath`, no `unstable_cache`** | **No D1 tag cache and no Durable Object queue needed.** We only add an R2 incremental cache (cheap, lightly used, future-proof). |
| **Only env vars used at runtime are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`** (both `NEXT_PUBLIC_`, inlined at build) | **Zero runtime Worker secrets.** `SUPABASE_URL` / `SUPABASE_DB_URL` are only referenced in `scripts/`, `tests/`, `e2e/`, `src/test-utils/` — not in deployed code. |
| **Auth = `@supabase/ssr` cookie sessions in `src/middleware.ts`** | Middleware runs inside the Worker. `createServerClient` + `getClaims()` use only `cookies` + `fetch`, which work on Workers. The `global_fetch_strictly_public` compat flag (below) keeps self-`fetch` behaving correctly. |
| **2 stages, 2 domains**: `intranet.shweb.org` (prod) and `intranet-beta.shweb.org` (preprod) | One wrangler config with a top-level (production) env + a `preprod` env, each bound to its own domain and R2 bucket. |
| **Images**: `next/image` with `remotePatterns` for `deifkwefumgah.cloudfront.net` | `remotePatterns` stays. Cloudflare image optimization is wired via the `IMAGES` binding. That CloudFront host is an external/template asset CDN, not our infra — leave it. |

---

## 1. Decisions to confirm before starting

These two are the only things not derivable from the code:

1. **Is `shweb.org` already a Cloudflare zone?**
   Workers custom domains require the domain's DNS to be served by Cloudflare.
   - **If yes** (zone exists): nothing to do at the registrar; we just create the
     Worker custom domains. Provide the **Zone ID**.
   - **If no**: add `shweb.org` to Cloudflare (`cloudflare_zone`) and change the
     registrar's nameservers to the two Cloudflare assigns. This is a manual,
     propagation-gated prerequisite — do it first. (Or use a partial/CNAME setup,
     but full setup is simplest for Workers.)

2. **Who owns the Worker ↔ domain binding — wrangler or Terraform?**
   - **Option A (recommended, simplest): wrangler `routes` with `custom_domain: true`.**
     Declared in `wrangler.jsonc` (in-repo, not dashboard clicking), wrangler
     auto-provisions the edge cert and the proxied DNS record. Avoids the
     Terraform-vs-wrangler overlap warning below.
   - **Option B (IaC-purist): Terraform `cloudflare_workers_custom_domain`.**
     Keep `routes` out of `wrangler.jsonc`; attach the domain in Terraform after the
     first deploy. More "everything in Terraform" but adds an ordering dependency and
     a `service`/`environment` mapping to verify against the pinned provider.

   R2 buckets (and the zone/DNS if you want it) are provisioned in Terraform either way.

> **Golden rule (from the Cloudflare Terraform guidance): wrangler and Terraform must
> not manage the same resource.** Split: **Terraform** = R2 buckets, zone, (optionally
> DNS / custom domain). **wrangler** = build + deploy the Worker script and its bindings.

---

## 2. Prerequisites

- Cloudflare account + **Account ID**.
- `shweb.org` reachable as a Cloudflare zone (see Decision 1) + **Zone ID**.
- A **Cloudflare API token** with: *Workers Scripts:Edit*, *Workers R2 Storage:Edit*,
  *Workers Routes:Edit*, *Account Settings:Read*, *Zone:Read*, and *DNS:Edit* (only if
  Terraform/wrangler manages DNS). Used by both Terraform (`CLOUDFLARE_API_TOKEN`) and CI.
- Node 22 (already pinned), npm (already the lockfile manager).
- Terraform >= 1.6 and `wrangler` >= 3.99 (installed as a dev dep below).

---

## 3. App code changes (manual steps)

### 3.1 Install adapter + wrangler, drop SST runtime dep later
```bash
npm install @opennextjs/cloudflare@latest
npm install --save-dev wrangler@latest
# (SST removal happens at cutover — section 8 — not yet.)
```

### 3.2 `open-next.config.ts` (repo root)
R2 incremental cache only — no tag cache / queue (app has no ISR/on-demand revalidation):
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
```
> Simpler still: `export default defineCloudflareConfig({});` (no override) ships with an
> in-Worker cache and needs **no R2 at all**. Given everything is `force-dynamic`, this is
> a legitimate starting point. We keep R2 to match the documented production default.

### 3.3 `wrangler.jsonc` (repo root)
Top-level = **production** (`intranet.shweb.org`); `env.preprod` = **preprod**
(`intranet-beta.shweb.org`). Each env gets its own R2 bucket binding and self-reference.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "intranet",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-03-25",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "images": { "binding": "IMAGES" },
  "observability": { "enabled": true },

  // --- production (top-level) ---
  "r2_buckets": [
    { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "intranet-cache-prod" }
  ],
  "services": [
    { "binding": "WORKER_SELF_REFERENCE", "service": "intranet" }
  ],
  // Option A only — wrangler-managed custom domain. Omit if using Terraform (Option B).
  "routes": [{ "pattern": "intranet.shweb.org", "custom_domain": true }],

  "env": {
    "preprod": {
      "name": "intranet-preprod",
      "r2_buckets": [
        { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "intranet-cache-preprod" }
      ],
      "services": [
        { "binding": "WORKER_SELF_REFERENCE", "service": "intranet-preprod" }
      ],
      "routes": [{ "pattern": "intranet-beta.shweb.org", "custom_domain": true }]
    }
  }
}
```
Notes:
- `WORKER_SELF_REFERENCE.service` **must equal the deployed worker name for that env**
  (`intranet` vs `intranet-preprod`) — required because we use the R2 incremental cache.
- `global_fetch_strictly_public` makes server-side `fetch()` to your own routes resolve
  over the public internet (correct middleware/image behavior).
- For **Option B** (Terraform domain): delete both `routes` arrays here.

### 3.4 `next.config.mjs` — initialize OpenNext dev shim
Append to the bottom (keep the existing `export default nextConfig`):
```js
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Dev-only: makes getCloudflareContext()/bindings work under `next dev`.
initOpenNextCloudflareForDev();
```
Everything already in `next.config.mjs` (`redirects()`, `images.remotePatterns`,
`outputFileTracingRoot`) is supported by OpenNext and stays.

### 3.5 `package.json` scripts
Add (keep `build`, `dev`, `start`, tests, etc. as-is):
```jsonc
{
  "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
  "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
  "deploy:preprod": "opennextjs-cloudflare build && opennextjs-cloudflare deploy --env preprod",
  "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
}
```
`deploy` (no `--env`) ships the top-level **production** worker; `deploy:preprod` ships
the `preprod` env. (Args after the OpenNext subcommand are forwarded to `wrangler`.)

### 3.6 Static-asset cache headers — `public/_headers`
```
/_next/static/*
  Cache-Control: public,max-age=31536000,immutable
```

### 3.7 Local dev secrets — `.dev.vars` (gitignored)
```
NEXTJS_ENV=development
```
> No app secrets needed. Keep using `.env.local` for the two `NEXT_PUBLIC_*` build vars
> exactly as today — `next dev` and `opennextjs-cloudflare build` both read it.

### 3.8 `.gitignore`
```
.open-next/
.dev.vars
cloudflare-env.d.ts
# terraform
terraform/.terraform/
*.tfstate
*.tfstate.*
.terraform.lock.hcl
```

### 3.9 Generate binding types (optional but nice)
```bash
npm run cf-typegen   # writes cloudflare-env.d.ts
```

---

## 4. Terraform — Cloudflare resources

Layout (per the Cloudflare TF guidance: environment dirs, no modules for provider resources):
```
terraform/
├── main.tf          # provider + resources
├── variables.tf
├── outputs.tf
└── terraform.tfvars # account_id, zone_id (gitignored if it holds anything sensitive)
```

`terraform/main.tf`:
```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }
  # Recommended: remote state in R2 (S3-compatible). Create this bucket once by hand
  # or in a bootstrap apply, then uncomment:
  # backend "s3" {
  #   bucket = "intranet-tf-state"
  #   key    = "cloudflare.tfstate"
  #   region = "auto"
  #   endpoints = { s3 = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com" }
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  #   skip_metadata_api_check     = true
  #   skip_s3_checksum            = true
  # }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# --- R2 incremental-cache buckets (one per stage) ---
resource "cloudflare_r2_bucket" "cache_prod" {
  account_id = var.account_id
  name       = "intranet-cache-prod"
  location   = "APAC" # UPPERCASE required; APAC ≈ Singapore audience for shweb.org
}

resource "cloudflare_r2_bucket" "cache_preprod" {
  account_id = var.account_id
  name       = "intranet-cache-preprod"
  location   = "APAC"
}

# --- Zone: ONLY if shweb.org is not already on Cloudflare (Decision 1) ---
# resource "cloudflare_zone" "shweb" {
#   account = { id = var.account_id }
#   name    = "shweb.org"
#   type    = "full"
# }

# --- Option B only: Terraform-managed Worker custom domains ---
# Requires the workers to have been deployed at least once (section 6) first,
# and `routes` removed from wrangler.jsonc. Verify arg names against provider ~>5.
# resource "cloudflare_workers_custom_domain" "prod" {
#   account_id  = var.account_id
#   zone_id     = var.zone_id
#   hostname    = "intranet.shweb.org"
#   service     = "intranet"
#   environment = "production"
# }
# resource "cloudflare_workers_custom_domain" "preprod" {
#   account_id  = var.account_id
#   zone_id     = var.zone_id
#   hostname    = "intranet-beta.shweb.org"
#   service     = "intranet-preprod"
#   environment = "production"
# }
```

`terraform/variables.tf`:
```hcl
variable "cloudflare_api_token" { type = string, sensitive = true }
variable "account_id"           { type = string }
variable "zone_id"              { type = string }
```

`terraform/outputs.tf`:
```hcl
output "r2_cache_prod"    { value = cloudflare_r2_bucket.cache_prod.name }
output "r2_cache_preprod" { value = cloudflare_r2_bucket.cache_preprod.name }
```

Apply:
```bash
cd terraform
export CLOUDFLARE_API_TOKEN=...      # or set var.cloudflare_api_token
terraform init
terraform plan -var account_id=<ACC_ID> -var zone_id=<ZONE_ID>
terraform apply -var account_id=<ACC_ID> -var zone_id=<ZONE_ID>
```
> The R2 **bucket names** in Terraform must match `bucket_name` in `wrangler.jsonc`.
> wrangler references them by name; Terraform creates them. Neither touches the other's
> resource — no drift.

---

## 5. Environment variables & secrets

| Var | Type | Where it lives now → after migration |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Build-time (inlined) | GitHub Actions env at **build** time (CI) + `.env.local` locally |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Build-time (inlined) | same |
| *(none)* | Runtime secret | — nothing runs server-side that needs a secret |

So there is **nothing to `wrangler secret put`**. The two public vars only need to be
present in the environment that runs `opennextjs-cloudflare build`.

> If a future server-only secret appears, set it per env with
> `wrangler secret put NAME --env preprod` (and prod). Keep secrets **out of Terraform
> state**; if you must put them in TF, use `lifecycle { ignore_changes = [...] }`.

---

## 6. First manual deploy (verify before touching CI)

```bash
# Local smoke test in the real Workers runtime:
npm run preview            # builds + serves on workerd via wrangler dev

# Deploy preprod, then production:
npx wrangler login         # or export CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npm run deploy:preprod
npm run deploy             # production
```
If using **Option B**, run `terraform apply` again now to attach the custom domains
(workers exist after the deploys above).

Verify on each domain: Google OAuth login round-trip, session persists across navigation,
no session bleed between accounts, dashboard data loads, `next/image` renders, the
`next.config.mjs` redirects (`/dashboard/mycca` → `/dashboard/my-cca`, etc.) 301 correctly.

---

## 7. CI/CD rewrite (GitHub Actions)

Four workflows exist; the two **release** ones deploy via SST and must change. The tag
flow (`vX.Y.Z-rc` → preprod → auto-promote `vX.Y.Z` → prod) is preserved.

Replace the AWS/SST steps with Cloudflare. Per release job:

- **Remove**: `aws-actions/configure-aws-credentials`, the SST/Pulumi cache step, and the
  `sst deploy --stage ...` step.
- **Add** repo/environment secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
  (the existing `NEXT_PUBLIC_*` GitHub secrets stay — they're build inputs).
- **Replace the deploy step** with:

```yaml
      - name: Deploy to Cloudflare (preprod)
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY }}
        run: npm run deploy:preprod      # prod job uses: npm run deploy
```

`4-prd-release.yml` does the same with `npm run deploy`. `1-feature-branch-ci.yml` and
`2-merge-request-ci.yml` (lint/typecheck/test) are unaffected — optionally add
`opennextjs-cloudflare build` as a build-smoke check.

> Optional: run `terraform apply` in CI before the first deploy of a new resource, then
> `wrangler deploy`. For steady state, Terraform rarely changes (buckets are stable), so
> applying it manually or in a separate IaC workflow is fine.

---

## 8. Cutover & decommission AWS

1. Deploy + verify on Cloudflare while AWS is still live (Workers on the real domains
   means flip DNS last — until the custom domain is attached, test via the `*.workers.dev`
   URL or a temporary hostname).
2. Cut DNS: attaching the Workers custom domain (Option A wrangler route, or Option B TF)
   repoints `intranet.shweb.org` / `intranet-beta.shweb.org` to the Worker.
3. Watch logs (`wrangler tail --env preprod`) + auth flows for a release cycle.
4. **Only then** decommission AWS:
   - `npx sst remove --stage preprod` and `--stage prd`.
   - Delete `sst.config.ts`, `.sst/`, and the `sst` dependency from `package.json`.
   - Remove `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` from GitHub.

**Rollback**: until step 4, AWS is intact — revert the DNS/custom-domain change to fail back.

---

## 9. Gotchas specific to this app

- **Supabase cookie auth in middleware** is the riskiest surface. It uses only
  `cookies` + `fetch` (no edge-only APIs), so it runs on Workers — but verify the
  full OAuth callback (`/auth/callback`) and the foreign-projref cookie eviction logic
  end-to-end on a deployed preprod, not just `next dev`.
- **`global_fetch_strictly_public`** must be present, or server-side self-`fetch` (used by
  image optimization and some Next internals) can loop back internally and misbehave.
- **R2 bucket name = `bucket_name` in wrangler.jsonc** — a typo here surfaces as a runtime
  cache error, not a deploy error.
- **`WORKER_SELF_REFERENCE` per env** — must match `intranet` (prod) vs `intranet-preprod`.
- **Worker size limit 10 MB** (gzipped, higher on paid). 32 API routes + Supabase client
  is comfortably under, but watch it if dependencies grow.
- **Next version**: OpenNext supports 15's latest minors — consider `npm i next@^15` to
  pull the newest 15.x before first deploy.
- **`deifkwefumgah.cloudfront.net`** image host is external/template content, not our AWS —
  leaving the SST stack's S3/CloudFront removal won't affect it.

---

## 10. Manual-steps checklist

- [ ] Confirm Decision 1 (zone) + Decision 2 (domain owner: wrangler vs TF).
- [ ] Create Cloudflare API token; gather Account ID + Zone ID.
- [ ] `npm i @opennextjs/cloudflare@latest` + `npm i -D wrangler@latest`.
- [ ] Add `open-next.config.ts`, `wrangler.jsonc`, `public/_headers`, `.dev.vars`.
- [ ] Patch `next.config.mjs` (`initOpenNextCloudflareForDev`) + `package.json` scripts + `.gitignore`.
- [ ] `terraform apply` (R2 buckets; zone/custom-domain if applicable).
- [ ] `npm run preview` locally → `npm run deploy:preprod` → verify → `npm run deploy`.
- [ ] Attach custom domains; verify auth + redirects + images on both domains.
- [ ] Rewrite `3-preprod-release.yml` + `4-prd-release.yml`; add CF secrets, remove AWS.
- [ ] Soak one release cycle, then decommission AWS/SST.

---

### Sources
- OpenNext Cloudflare — Get Started, Caching, Bindings: https://opennext.js.org/cloudflare
- Next.js on Cloudflare Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Wrangler config & environments: https://developers.cloudflare.com/workers/wrangler/configuration/ , https://developers.cloudflare.com/workers/wrangler/environments/
- Workers custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Cloudflare Terraform provider (v5): https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs

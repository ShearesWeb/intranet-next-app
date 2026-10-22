# Telegram account-linking operations

The account-linking API is server-to-server. Browser code must never receive
AWS credentials, the Telegram bot token, or a Supabase service-role key.

## Runtime configuration

Configure these bindings separately on the `intranet-preprod` and `intranet`
Cloudflare Workers:

- `TELEGRAM_LINK_API_URL`: the bot infrastructure's `auth_api_invoke_url`
  Terraform output.
- `TELEGRAM_LINK_AWS_ACCESS_KEY_ID`: an encrypted Worker secret.
- `TELEGRAM_LINK_AWS_SECRET_ACCESS_KEY`: an encrypted Worker secret.
- `TELEGRAM_LINK_AWS_REGION`: optional; defaults to `ap-southeast-1`.

The access key belongs to the dedicated IAM user named by the bot
infrastructure's `intranet_link_caller_user_name` output. Terraform creates the
user and its route-scoped `execute-api:Invoke` policy, but intentionally does
not create an access key. Create and rotate the key through the approved
operations process, then store both credential values directly as Cloudflare
Worker secrets. Never put them in `.env`, Wrangler config, Git, browser code,
or Terraform state.

Deploy uses Wrangler's `--keep-vars` option so runtime variables and secrets
configured in Cloudflare are not deleted. The deployment must fail closed if
any required binding is missing.

## Trust and replay boundaries

1. Telegram signs webhook delivery with its configured webhook secret.
2. `/link` works only in a private chat and delivers a random 10-minute token
   to that Telegram account.
3. Supabase `requireAuth()` derives the resident ID; browser JSON cannot choose
   it.
4. The intranet signs the complete request with SigV4. The IAM user can invoke
   only the preview and complete routes.
5. DynamoDB consumes the token and creates both one-to-one mapping records in
   one transaction. A replay cannot create or alter a link.
6. Same-origin and JSON-content checks protect the browser completion route
   from CSRF.

Before enabling preprod, configure the Telegram webhook secret in both the bot
Lambda environment and Telegram `setWebhook`, then exercise successful,
expired, replayed, duplicate-resident, duplicate-Telegram, and cross-origin
requests. Production remains disabled until those preprod checks pass.

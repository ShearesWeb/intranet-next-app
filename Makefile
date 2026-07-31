# Task runner. package.json holds only the Next.js commands; everything else is
# here. Local binaries are put on PATH so recipes call them directly.

ROOT        := $(CURDIR)
export PATH := $(ROOT)/node_modules/.bin:$(PATH)

# Schema repo; falls back to a sibling checkout when the submodule is empty.
INTRANET ?= $(ROOT)/vendor/intranet
ifeq ($(wildcard $(INTRANET)/Makefile),)
INTRANET := $(ROOT)/../intranet
endif

DB_PORT   ?= 5432
REST_PORT ?= 3001
JWT       ?= super-secret-jwt-token-with-at-least-32-characters-long
PGURL     := postgresql://postgres:postgres@127.0.0.1:$(DB_PORT)/postgres
REST      := intranet-test-postgrest

# prd = top-level wrangler config (no --env); other envs pass --env.
ENV  ?= prd
ENVF := $(if $(filter-out prd,$(ENV)),--env $(ENV),)

.DEFAULT_GOAL := help
.PHONY: help check format format-check typecheck test test-integration \
        db-up db-down e2e-login e2e-personas preview deploy cf-typegen

help: ## List targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?##"} {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

check: format-check typecheck test ## Format + types + unit tests

format: ## Prettier write
	prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"

format-check: ## Prettier check
	prettier --check "src/**/*.{ts,tsx,js,jsx,json,css,md}"

typecheck: ## tsc --noEmit (app + tests)
	tsc --noEmit
	tsc --noEmit -p tsconfig.test.json

test: ## Unit + component (Vitest)
	vitest run

test-integration: ## Route-handler suite (needs db-up)
	vitest run --config vitest.integration.config.mts

db-up: ## Start Postgres + schema + seed + PostgREST
	@test -f "$(INTRANET)/Makefile" || { echo "schema repo not found at $(INTRANET) (git submodule update --init, or set INTRANET=)"; exit 1; }
	$(MAKE) -C "$(INTRANET)" db-up DB_PORT=$(DB_PORT)
	liquibase --search-path="$(INTRANET)/db/changelogs" --changeLogFile="qa.changelog-master.xml" --url="jdbc:postgresql://127.0.0.1:$(DB_PORT)/postgres" --username=postgres --password=postgres --contexts=local update
	psql "$(PGURL)" -v ON_ERROR_STOP=1 -f "$(ROOT)/tests/integration/harness.sql"
	psql "$(PGURL)" -v ON_ERROR_STOP=1 -f "$(ROOT)/tests/fixtures/seed.sql" >/dev/null
	-docker rm -f $(REST) >/dev/null 2>&1
	docker run -d --name $(REST) \
		--add-host=host.docker.internal:host-gateway \
		-p $(REST_PORT):3000 \
		-e PGRST_DB_URI="postgres://authenticator:postgres@host.docker.internal:$(DB_PORT)/postgres" \
		-e PGRST_DB_SCHEMAS="public" \
		-e PGRST_DB_ANON_ROLE="anon" \
		-e PGRST_JWT_SECRET="$(JWT)" \
		postgrest/postgrest >/dev/null
	@n=0; until curl -sf "http://localhost:$(REST_PORT)/" >/dev/null 2>&1 || [ $$n -ge 30 ]; do n=$$((n+1)); sleep 1; done
	@echo "DB ready: $(PGURL)  PostgREST: http://localhost:$(REST_PORT)"

db-down: ## Stop PostgREST + Postgres
	-docker rm -f $(REST) >/dev/null 2>&1
	-test -f "$(INTRANET)/Makefile" && $(MAKE) -C "$(INTRANET)" db-down
	@echo "DB stopped."

e2e-personas: ## List personas
	tsx e2e/cli.ts personas

e2e-login: ## Magic-link for a persona — make e2e-login PERSONA=declan
	tsx e2e/cli.ts login $(PERSONA)

preview: ## Build + run locally (wrangler dev)
	opennextjs-cloudflare build
	opennextjs-cloudflare preview

deploy: ## Build + deploy to Cloudflare (ENV=prd default, or ENV=preprod)
	opennextjs-cloudflare build $(ENVF)
	rm -rf .open-next/cache
	opennextjs-cloudflare deploy $(ENVF)

cf-typegen: ## Generate cloudflare-env.d.ts
	wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts

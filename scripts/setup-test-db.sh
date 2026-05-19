#!/usr/bin/env bash
# scripts/setup-test-db.sh
#
# Boot the local Supabase stack, apply the canonical schema from the sibling
# intranet repo via Liquibase, and load tests/fixtures/seed.sql.
#
# Usage:
#   ./scripts/setup-test-db.sh            # full bootstrap
#   ./scripts/setup-test-db.sh --reseed   # skip supabase start + liquibase; just rerun seed.sql
#
# Env vars:
#   INTRANET_REPO_PATH   absolute or relative path to the intranet repo
#                        (default: ../intranet, resolved from this script's directory)
#   SUPABASE_DB_URL      override DB connection string used for seed apply
#                        (default: postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres
#                         — supabase_admin is the actual superuser in local Supabase and owns the
#                         schema objects Liquibase creates; seed.sql's TRUNCATE ... CASCADE requires
#                         this. Application/test code still authenticates via Supabase Auth using
#                         the JWT secret / sb_publishable key, not these credentials.)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

INTRANET_REPO_PATH="${INTRANET_REPO_PATH:-$REPO_ROOT/../intranet}"
SUPABASE_DB_URL="${SUPABASE_DB_URL:-postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres}"
LIQUIBASE_CHANGELOG="$INTRANET_REPO_PATH/db/changelogs/qa.changelog-master.xml"

RESEED_ONLY=0
if [[ "${1:-}" == "--reseed" ]]; then
	RESEED_ONLY=1
fi

log() { printf '[setup-test-db] %s\n' "$*"; }
die() { printf '[setup-test-db] ERROR: %s\n' "$*" >&2; exit 1; }

if [[ ! -f "$LIQUIBASE_CHANGELOG" ]]; then
	die "Liquibase changelog not found at $LIQUIBASE_CHANGELOG. Set INTRANET_REPO_PATH or clone the intranet repo."
fi

if [[ "$RESEED_ONLY" -eq 0 ]]; then
	if ! command -v supabase >/dev/null 2>&1; then
		die "supabase CLI not found. brew install supabase/tap/supabase"
	fi
	if ! command -v liquibase >/dev/null 2>&1; then
		die "liquibase not found. brew install liquibase"
	fi

	log "Starting Supabase (this can take ~30-60s on first run)…"
	supabase start

	# Supabase always creates a `storage.buckets` table during init that lacks
	# the `public` column the qa stub expects. Drop it so the qa stub's
	# `CREATE TABLE IF NOT EXISTS storage.buckets` actually creates the table
	# with the correct shape. (Storage is disabled in config.toml, so nothing
	# in the local stack depends on the Supabase-shaped variant.)
	log "Dropping Supabase-shipped storage.buckets/objects so qa stubs can recreate them"
	psql "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -c "
		DROP TABLE IF EXISTS storage.objects CASCADE;
		DROP TABLE IF EXISTS storage.buckets CASCADE;
	"

	log "Applying Liquibase changelog from $INTRANET_REPO_PATH"
	# Use supabase_admin (the actual superuser in local Supabase) so Liquibase
	# can create objects in reserved schemas like auth/storage. The default
	# `postgres` role in modern Supabase is no longer a superuser.
	liquibase \
		--search-path="$INTRANET_REPO_PATH/db/changelogs" \
		--changeLogFile="qa.changelog-master.xml" \
		--url="jdbc:postgresql://127.0.0.1:54322/postgres" \
		--username=supabase_admin \
		--password=postgres \
		--contexts=local \
		update
fi

log "Ensuring fixtures are up to date"
npm run --silent fixtures:check || {
	log "Fixtures drift detected — regenerating"
	npm run --silent fixtures:generate
}

log "Applying seed.sql"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/fixtures/seed.sql"

log "Done. DB ready at $SUPABASE_DB_URL"

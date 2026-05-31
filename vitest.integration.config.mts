import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `@/*` -> `./src/*`, mirroring tsconfig.json `paths`. Explicit alias instead of
// the `vite-tsconfig-paths` plugin (removed — see vitest.config.mts).
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Integration test config — runs against a live local Supabase / Postgres.
// Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
// (populated by `scripts/setup-test-db.sh` writing .env.test, or by `supabase status`).
export default defineConfig({
	resolve: {
		alias: { "@": srcDir },
	},
	test: {
		name: "integration",
		environment: "node",
		include: ["tests/integration/**/*.test.ts"],
		setupFiles: ["./tests/integration/setup.ts"],
		globals: true,
		testTimeout: 30_000,
		hookTimeout: 30_000,
		pool: "forks",
		// Integration tests share ONE local Postgres. Run files serially so
		// uncommitted BEGIN/ROLLBACK transactions in different files can't
		// contend on the same rows/unique-keys across parallel forks (which
		// deadlocks/blocks indefinitely with no statement_timeout). The suite is
		// tiny, so the serial cost is negligible and execution is deterministic.
		fileParallelism: false,
	},
});

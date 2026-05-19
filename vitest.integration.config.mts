import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration test config — runs against a live local Supabase / Postgres.
// Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
// (populated by `scripts/setup-test-db.sh` writing .env.test, or by `supabase status`).
export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		name: "integration",
		environment: "node",
		include: ["tests/integration/**/*.test.ts"],
		setupFiles: ["./tests/integration/setup.ts"],
		globals: true,
		testTimeout: 30_000,
		hookTimeout: 30_000,
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: false,
			},
		},
	},
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Route-handler suite against the `make db-up` stack. Env in .env.test.
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
		// Serial: one shared DB, reseeded before every test.
		fileParallelism: false,
	},
});

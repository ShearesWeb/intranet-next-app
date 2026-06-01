import path from "node:path";
import { defineConfig } from "@playwright/test";
import { SUPABASE_URL, ANON_KEY, APP_URL, E2E_PORT } from "./auth-harness";

export default defineConfig({
	globalSetup: "./global-setup.ts",
	testDir: "./specs",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	// In CI emit GitHub annotations AND a self-contained HTML report so failed
	// runs can be uploaded as an artifact (see the e2e CI jobs). `open: never`
	// keeps the report from trying to launch a browser on the runner.
	reporter: process.env.CI
		? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
		: "html",
	use: {
		baseURL: APP_URL,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
		{
			name: "headed",
			fullyParallel: false,
			use: {
				browserName: "chromium",
				headless: false,
				launchOptions: { slowMo: 400 },
			},
		},
	],
	webServer: {
		command: `node_modules/.bin/next dev -p ${E2E_PORT}`,
		cwd: path.resolve(__dirname, ".."),
		port: E2E_PORT,
		timeout: 60_000,
		reuseExistingServer: !process.env.CI,
		env: {
			RTK_DISABLED: "1",
			NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ANON_KEY,
			NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
		},
	},
});

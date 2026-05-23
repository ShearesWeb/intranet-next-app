import { defineConfig } from "@playwright/test";
import { SUPABASE_URL, ANON_KEY } from "./auth-harness";

export default defineConfig({
	testDir: "./specs",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "github" : "html",
	use: {
		baseURL: process.env.APP_URL ?? "http://localhost:3000",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
	],
	webServer: {
		command: "npm run dev",
		port: 3000,
		reuseExistingServer: !process.env.CI,
		env: {
			NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ANON_KEY,
			NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
		},
	},
});

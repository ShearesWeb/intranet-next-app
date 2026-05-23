# E2E Testing Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright-based E2E testing harness with persona-based role switching — both a CLI for manual browser testing and fixtures for automated headless tests.

**Architecture:** An auth harness creates real Supabase sessions via the Admin API and injects them as cookies into Playwright browser contexts. The app runs unmodified against local Supabase. The harness reuses the existing persona definitions from `tests/fixtures/personas.ts`. The DB function `internal.auth_user_id()` resolves via `auth.email()`, so the only requirement is that GoTrue auth user emails match the seeded `users.email` values — no schema changes needed.

**Tech Stack:** Playwright, `@supabase/supabase-js` (Admin API), `@supabase/ssr` (cookie formatting), `uuid` (deterministic IDs), `tsx` (CLI runner)

**Prerequisite:** Local Supabase must be running with the schema and seed data applied. Run `npm run db:test:setup` (which calls `scripts/setup-test-db.sh` — starts Supabase, applies Liquibase changelogs, seeds fixture data).

---

### Task 1: Install dependencies and update project config

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev @playwright/test tsx uuid @types/uuid
```

- [ ] **Step 2: Install Playwright Chromium browser**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Add npm scripts to package.json**

Add these entries to the `"scripts"` object in `package.json`, after the existing `test:watch` entry:

```json
"e2e": "playwright test --config e2e/playwright.config.ts",
"e2e:headed": "playwright test --config e2e/playwright.config.ts --headed",
"e2e:ui": "playwright test --config e2e/playwright.config.ts --ui",
"e2e:login": "tsx e2e/cli.ts login",
"e2e:personas": "tsx e2e/cli.ts personas"
```

- [ ] **Step 4: Add Playwright artifacts to .gitignore**

Append to `.gitignore`:

```
# Playwright
test-results/
playwright-report/
blob-report/
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add Playwright, tsx, uuid for E2E harness"
```

---

### Task 2: Auth harness

**Files:**
- Create: `e2e/auth-harness.ts`

This is the shared core — both the CLI and Playwright fixtures consume it. It creates GoTrue auth users matching personas and generates valid session cookies.

- [ ] **Step 1: Create `e2e/auth-harness.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { v5 as uuidv5 } from "uuid";
import { personaByKey } from "../tests/fixtures/personas";
import type { Persona } from "../tests/fixtures/types";

const E2E_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const LOCAL_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const LOCAL_SERVICE_ROLE_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IQ";

export const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY;
export const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY;
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

export function personaUUID(key: string): string {
	return uuidv5(key, E2E_NAMESPACE);
}

export async function ensureAuthUser(persona: Persona): Promise<string> {
	if (!persona.email) throw new Error(`Cannot create auth user for anonymous persona`);
	const id = personaUUID(persona.key);
	const { error } = await adminClient.auth.admin.createUser({
		id,
		email: persona.email,
		email_confirm: true,
	});
	if (error && !error.message.includes("already been registered")) {
		throw new Error(`Failed to create auth user for ${persona.key}: ${error.message}`);
	}
	return id;
}

export async function getSessionCookies(
	personaKey: string,
): Promise<Array<{ name: string; value: string; url: string }>> {
	const persona = personaByKey(personaKey);
	if (!persona.email) throw new Error(`Cannot create session for anonymous persona "${personaKey}"`);

	await ensureAuthUser(persona);

	const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
		type: "magiclink",
		email: persona.email,
	});
	if (linkError || !linkData) {
		throw new Error(`Failed to generate magic link for ${personaKey}: ${linkError?.message}`);
	}

	const captured: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
	const ssrClient = createServerClient(SUPABASE_URL, ANON_KEY, {
		cookies: {
			getAll: () => [],
			setAll: (cookies) => {
				captured.push(...cookies);
			},
		},
	});

	const { error: verifyError } = await ssrClient.auth.verifyOtp({
		token_hash: linkData.properties.hashed_token,
		type: "magiclink",
	});
	if (verifyError) {
		throw new Error(`Failed to verify OTP for ${personaKey}: ${verifyError.message}`);
	}

	if (captured.length === 0) {
		throw new Error(`No cookies captured for ${personaKey} — SSR client did not call setAll`);
	}

	return captured.map((c) => ({
		name: c.name,
		value: c.value,
		url: APP_URL,
	}));
}
```

- [ ] **Step 2: Verify `personaUUID` produces consistent values**

Run:

```bash
npx tsx -e "
  const { personaUUID } = require('./e2e/auth-harness');
  const a = personaUUID('declan');
  const b = personaUUID('declan');
  const c = personaUUID('aria');
  console.log('declan:', a);
  console.log('declan again:', b);
  console.log('aria:', c);
  console.log('deterministic:', a === b);
  console.log('different personas differ:', a !== c);
"
```

Expected: `deterministic: true` and `different personas differ: true`. Both UUIDs are valid v5 format.

- [ ] **Step 3: Commit**

```bash
git add e2e/auth-harness.ts
git commit -m "feat(e2e): auth harness — persona UUID, ensureAuthUser, getSessionCookies"
```

---

### Task 3: Playwright config and fixtures

**Files:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/fixtures.ts`

- [ ] **Step 1: Create `e2e/playwright.config.ts`**

```ts
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
```

- [ ] **Step 2: Create `e2e/fixtures.ts`**

```ts
import { test as base, type Page } from "@playwright/test";
import { getSessionCookies } from "./auth-harness";

export const test = base.extend<{
	asPersona: (key: string) => Promise<Page>;
}>({
	asPersona: async ({ browser }, use) => {
		const contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = [];

		await use(async (key: string) => {
			const cookies = await getSessionCookies(key);
			const context = await browser.newContext();
			await context.addCookies(cookies);
			contexts.push(context);
			const page = await context.newPage();
			return page;
		});

		for (const ctx of contexts) {
			await ctx.close();
		}
	},
});

export { expect } from "@playwright/test";
```

- [ ] **Step 3: Create empty specs directory**

```bash
mkdir -p e2e/specs
```

- [ ] **Step 4: Commit**

```bash
git add e2e/playwright.config.ts e2e/fixtures.ts
git commit -m "feat(e2e): Playwright config and asPersona fixture"
```

---

### Task 4: CLI tool

**Files:**
- Create: `e2e/cli.ts`

- [ ] **Step 1: Create `e2e/cli.ts`**

```ts
import { chromium } from "@playwright/test";
import { getSessionCookies, APP_URL } from "./auth-harness";
import { PERSONAS } from "../tests/fixtures/personas";
import { POSITIONS } from "../tests/fixtures/positions";

function printPersonas(): void {
	console.log("\nAvailable personas:\n");

	for (const p of PERSONAS) {
		const tags: string[] = [];
		if (p.expected.is_admin) tags.push("[admin]");
		if (p.expected.is_jcrc) tags.push("[JCRC]");
		if (p.expected.is_culture_sports_admin) tags.push("[CSA]");

		const appointments = p.appointments
			.map((a) => {
				const pos = POSITIONS.find(
					(pos) => pos.ccaKey === a.ccaKey && pos.name === a.positionName,
				);
				return pos ? `${a.ccaKey}/${pos.positionType}` : `${a.ccaKey}/${a.positionName}`;
			})
			.join(", ");

		const desc = p.email === null ? "unauthenticated" : appointments || "regular resident";
		const tagStr = tags.length > 0 ? "  " + tags.join(" ") : "";
		console.log(`  ${p.key.padEnd(12)} — ${desc}${tagStr}`);
	}
	console.log("");
}

async function login(personaKey: string): Promise<void> {
	const persona = PERSONAS.find((p) => p.key === personaKey);
	if (!persona) {
		console.error(`Unknown persona: "${personaKey}"`);
		console.error(`Run "npx tsx e2e/cli.ts personas" to list available personas.`);
		process.exit(1);
	}
	if (!persona.email) {
		console.error(`Cannot login as anonymous persona.`);
		process.exit(1);
	}

	console.log(`Creating session for ${persona.name} (${persona.key})...`);
	const cookies = await getSessionCookies(personaKey);

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	await context.addCookies(cookies);

	const page = await context.newPage();
	await page.goto(`${APP_URL}/dashboard`);

	const tags: string[] = [];
	if (persona.expected.is_admin) tags.push("admin");
	if (persona.expected.is_jcrc) tags.push("JCRC");
	if (persona.expected.is_culture_sports_admin) tags.push("CSA");
	const roleStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
	console.log(`\n✓ Browser opened as ${persona.name}${roleStr}`);
	console.log(`  ${APP_URL}/dashboard`);
	console.log(`\nClose the browser or press Ctrl+C to exit.\n`);

	await new Promise<void>((resolve) => {
		browser.on("disconnected", resolve);
		process.on("SIGINT", async () => {
			await browser.close();
			resolve();
		});
	});
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
	case "personas":
		printPersonas();
		break;
	case "login":
		if (!args[0]) {
			console.error('Usage: npx tsx e2e/cli.ts login <persona>');
			process.exit(1);
		}
		login(args[0]).catch((err) => {
			console.error(err.message);
			process.exit(1);
		});
		break;
	default:
		console.error("Usage:");
		console.error("  npx tsx e2e/cli.ts personas        — list available personas");
		console.error("  npx tsx e2e/cli.ts login <persona>  — open browser as persona");
		process.exit(1);
}
```

- [ ] **Step 2: Verify the `personas` command works**

Run:

```bash
npx tsx e2e/cli.ts personas
```

Expected: prints all 16 personas with their roles and flags. No Supabase connection needed for this command.

- [ ] **Step 3: Commit**

```bash
git add e2e/cli.ts
git commit -m "feat(e2e): CLI tool — login and personas commands"
```

---

### Task 5: Auth smoke test

**Files:**
- Create: `e2e/specs/auth.spec.ts`

**Prerequisite:** Local Supabase must be running with schema and seed data. If not already done:

```bash
npm run db:test:setup
```

- [ ] **Step 1: Create `e2e/specs/auth.spec.ts`**

```ts
import { test, expect } from "../fixtures";

test.describe("authentication", () => {
	test("unauthenticated user is redirected to login", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test("authenticated user can access dashboard", async ({ asPersona }) => {
		const page = await asPersona("aria");
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("admin persona sees dashboard", async ({ asPersona }) => {
		const page = await asPersona("declan");
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("JCRC persona sees dashboard", async ({ asPersona }) => {
		const page = await asPersona("brielle");
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test("two personas have isolated sessions", async ({ asPersona }) => {
		const ariaPage = await asPersona("aria");
		const declanPage = await asPersona("declan");

		await ariaPage.goto("/dashboard");
		await declanPage.goto("/dashboard");

		await expect(ariaPage).toHaveURL(/\/dashboard/);
		await expect(declanPage).toHaveURL(/\/dashboard/);
	});
});
```

- [ ] **Step 2: Run the E2E tests**

```bash
npm run e2e
```

Expected: all 5 tests pass. The webServer config starts `npm run dev` automatically (or reuses an existing server).

- [ ] **Step 3: Verify the CLI login works**

Start the dev server pointing at local Supabase (in a separate terminal):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0 \
npm run dev
```

Then in another terminal:

```bash
npm run e2e:login -- declan
```

Expected: Chromium opens to `/dashboard` logged in as Declan Ho. The dashboard should show admin-level content. Close browser or Ctrl+C to exit.

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/auth.spec.ts
git commit -m "test(e2e): auth smoke tests — redirects, personas, session isolation"
```

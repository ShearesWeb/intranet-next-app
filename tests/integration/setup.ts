// Integration setup (vitest setupFiles). Stack is brought up by `make db-up`.

import * as fs from "node:fs";
import * as path from "node:path";
import { config as loadDotenv } from "dotenv";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";

loadDotenv({ path: ".env.test" });

// Route the supabase server client through PostgREST as the active persona.
vi.mock("@/lib/supabase/server", async () => {
	const mod = await import("@/test-utils/integration/persona-supabase");
	return { createClient: async () => mod.buildClientForActivePersona() };
});

// Next runtime helpers throw outside a request scope; no-op them in-process.
vi.mock("next/cache", () => ({
	unstable_noStore: () => {},
	revalidatePath: () => {},
	revalidateTag: () => {},
}));
vi.mock("next/headers", () => ({
	cookies: async () => ({
		getAll: () => [],
		get: () => undefined,
		set: () => {},
		delete: () => {},
	}),
	headers: async () => new Headers(),
}));

const DATABASE_URL =
	process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

export const pgPool = new Pool({ connectionString: DATABASE_URL, max: 4 });

const SEED_SQL = fs.readFileSync(path.resolve(__dirname, "../fixtures/seed.sql"), "utf8");

// seed.sql deletes its own rows first, so this restores a clean baseline.
export async function reseed(): Promise<void> {
	await pgPool.query(SEED_SQL);
}

beforeAll(async () => {
	try {
		const r = await pgPool.query("SELECT 1 AS ok");
		if (r.rows[0]?.ok !== 1) throw new Error("unexpected health-check result");
	} catch (e) {
		throw new Error(
			`Integration DB not reachable at ${DATABASE_URL}. Run \`make db-up\` first.\n${String(e)}`,
		);
	}
});

beforeEach(async () => {
	await reseed();
});

afterAll(async () => {
	await pgPool.end();
});

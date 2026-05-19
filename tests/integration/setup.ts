// Integration test setup — runs once per Vitest worker. Loads env, opens a pg pool,
// creates an admin Supabase client, and pre-mints sessions for every persona.
//
// Imported via Vitest's `setupFiles` in vitest.integration.config.mts.

import { config as loadDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { afterAll, beforeAll } from "vitest";
import { authenticatedPersonas } from "../fixtures/personas";
import type { PersonaKey } from "../fixtures/types";

loadDotenv({ path: ".env.test" });

const SUPABASE_URL = required("SUPABASE_URL");
const SUPABASE_ANON_KEY = required("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_DB_URL = required("SUPABASE_DB_URL");

function required(name: string): string {
	const v = process.env[name];
	if (!v) {
		throw new Error(
			`Integration tests require ${name} in env. Run \`./scripts/setup-test-db.sh\` and copy values from \`supabase status\` into .env.test.`,
		);
	}
	return v;
}

export const pgPool = new Pool({ connectionString: SUPABASE_DB_URL, max: 8 });

export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

export const supabaseAnonClientFactory = () =>
	createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

export type PersonaSession = {
	accessToken: string;
	refreshToken: string;
	userId: string; // Supabase auth.users.id (UUID), NOT public.users.id (int).
	email: string;
};

const sessionCache = new Map<PersonaKey, PersonaSession>();

export async function getPersonaSession(key: PersonaKey): Promise<PersonaSession> {
	if (key === "anonymous") {
		throw new Error("anonymous persona has no session; use the anon client directly");
	}
	const cached = sessionCache.get(key);
	if (cached) return cached;

	const persona = authenticatedPersonas().find((p) => p.key === key);
	if (!persona || !persona.email) throw new Error(`No email for persona ${key}`);

	const password = `persona-${key}-${SUPABASE_SERVICE_ROLE_KEY.slice(-6)}`;
	const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
		email: persona.email,
		password,
		email_confirm: true,
	});

	let userId: string;
	if (createErr && !/already.*registered|already exists/i.test(createErr.message)) {
		throw new Error(`admin.createUser(${persona.email}) failed: ${createErr.message}`);
	}
	if (created?.user) {
		userId = created.user.id;
	} else {
		const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
		if (listErr) throw listErr;
		const found = list.users.find((u) => u.email === persona.email);
		if (!found) throw new Error(`Could not resolve auth user for ${persona.email}`);
		userId = found.id;
		const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
		if (updErr) throw updErr;
	}

	const anon = supabaseAnonClientFactory();
	const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
		email: persona.email,
		password,
	});
	if (signInErr || !signIn.session) {
		throw new Error(`signInWithPassword(${persona.email}) failed: ${signInErr?.message ?? "no session"}`);
	}

	const session: PersonaSession = {
		accessToken: signIn.session.access_token,
		refreshToken: signIn.session.refresh_token,
		userId,
		email: persona.email,
	};
	sessionCache.set(key, session);
	return session;
}

beforeAll(async () => {
	const r = await pgPool.query("SELECT 1 AS ok");
	if (r.rows[0]?.ok !== 1) throw new Error("pg pool health check failed");
});

afterAll(async () => {
	await pgPool.end();
});

export { authenticatedPersonas };

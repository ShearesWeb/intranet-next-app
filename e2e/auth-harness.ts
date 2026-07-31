// Mints a Supabase magic-link for a persona (manual QA). Needs SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY in .env.test or .env.local.

import * as path from "node:path";
import { config as loadDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { personaByKey } from "../tests/fixtures/personas";
import type { Persona } from "../tests/fixtures/types";

const E2E_TEST_PASSWORD = "e2e-test-P@ssw0rd!";

export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function readSupabaseAdmin(): { url: string; serviceRoleKey: string } {
	loadDotenv({ path: path.resolve(__dirname, "../.env.test"), override: false });
	loadDotenv({ path: path.resolve(__dirname, "../.env.local"), override: false });
	const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !serviceRoleKey) {
		throw new Error(
			"Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.test or .env.local) to mint persona login links.",
		);
	}
	return { url, serviceRoleKey };
}

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
	if (!_admin) {
		const { url, serviceRoleKey } = readSupabaseAdmin();
		_admin = createClient(url, serviceRoleKey, {
			auth: { autoRefreshToken: false, persistSession: false },
		});
	}
	return _admin;
}

async function ensureAuthUser(persona: Persona): Promise<void> {
	if (!persona.email) throw new Error("anonymous persona has no auth user");
	const { error } = await admin().auth.admin.createUser({
		email: persona.email,
		password: E2E_TEST_PASSWORD,
		email_confirm: true,
	});
	if (error && !/already|exists|registered/i.test(error.message)) {
		throw new Error(`createUser(${persona.email}) failed: ${error.message}`);
	}
}

/** Generate a one-time magic-link URL the developer opens to log in as the persona. */
export async function magicLinkFor(personaKey: string): Promise<string> {
	const persona = personaByKey(personaKey);
	if (!persona.email) throw new Error(`Cannot log in as anonymous persona "${personaKey}"`);

	await ensureAuthUser(persona);

	const { data, error } = await admin().auth.admin.generateLink({
		type: "magiclink",
		email: persona.email,
		options: { redirectTo: `${APP_URL}/dashboard` },
	});
	if (error || !data) {
		throw new Error(`generateLink(${persona.email}) failed: ${error?.message ?? "no data returned"}`);
	}
	const link = data.properties?.action_link ?? "";
	if (!link) throw new Error(`generateLink(${persona.email}) returned no action_link`);
	return link;
}

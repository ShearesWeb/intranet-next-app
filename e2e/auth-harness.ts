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

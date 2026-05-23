import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { v5 as uuidv5 } from "uuid";
import { personaByKey } from "../tests/fixtures/personas";
import type { Persona } from "../tests/fixtures/types";

const E2E_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function readSupabaseKeys(): { url: string; anonKey: string; serviceRoleKey: string } {
	if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY) {
		return {
			url: process.env.SUPABASE_URL,
			anonKey: process.env.SUPABASE_ANON_KEY,
			serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
		};
	}
	const raw = execSync("supabase status -o env", { encoding: "utf-8" });
	const vars = Object.fromEntries(
		raw
			.split("\n")
			.filter((l) => l.includes("="))
			.map((l) => {
				const eq = l.indexOf("=");
				return [l.slice(0, eq), l.slice(eq + 1).replace(/^"|"$/g, "")];
			}),
	);
	return {
		url: vars.API_URL ?? "http://127.0.0.1:54321",
		anonKey: vars.ANON_KEY ?? "",
		serviceRoleKey: vars.SERVICE_ROLE_KEY ?? "",
	};
}

const keys = readSupabaseKeys();
export const SUPABASE_URL = keys.url;
export const ANON_KEY = keys.anonKey;
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

let _adminClient: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
	if (!_adminClient) {
		_adminClient = createClient(SUPABASE_URL, keys.serviceRoleKey, {
			auth: { autoRefreshToken: false, persistSession: false },
		});
	}
	return _adminClient;
}

export function personaUUID(key: string): string {
	return uuidv5(key, E2E_NAMESPACE);
}

export async function ensureAuthUser(persona: Persona): Promise<string> {
	if (!persona.email) throw new Error(`Cannot create auth user for anonymous persona`);
	const id = personaUUID(persona.key);
	const { error } = await adminClient().auth.admin.createUser({
		id,
		email: persona.email,
		email_confirm: true,
	});
	if (error) {
		const msg = error.message.toLowerCase();
		if (msg.includes("already") || msg.includes("database error")) {
			return id;
		}
		throw new Error(`Failed to create auth user for ${persona.key}: ${error.message}`);
	}
	return id;
}

type CookieResult = Array<{ name: string; value: string; url: string }>;
const CACHE_FILE = path.join(__dirname, ".session-cache.json");

export async function getSessionCookies(personaKey: string): Promise<CookieResult> {
	if (fs.existsSync(CACHE_FILE)) {
		const cache: Record<string, CookieResult> = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
		if (cache[personaKey]) return cache[personaKey];
	}
	return generateSessionCookies(personaKey);
}

export async function warmSessionCache(personaKeys: string[]): Promise<void> {
	const cache: Record<string, CookieResult> = {};
	for (const key of personaKeys) {
		cache[key] = await generateSessionCookies(key);
	}
	fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), "utf-8");
}

async function generateSessionCookies(personaKey: string): Promise<CookieResult> {
	const persona = personaByKey(personaKey);
	if (!persona.email) throw new Error(`Cannot create session for anonymous persona "${personaKey}"`);

	await ensureAuthUser(persona);

	const { data: linkData, error: linkError } = await adminClient().auth.admin.generateLink({
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

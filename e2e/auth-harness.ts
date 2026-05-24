import * as fs from "node:fs";
import * as path from "node:path";
import { config as loadDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { v5 as uuidv5 } from "uuid";
import { personaByKey } from "../tests/fixtures/personas";
import type { Persona } from "../tests/fixtures/types";

const E2E_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const E2E_TEST_PASSWORD = "e2e-test-P@ssw0rd!";
export const E2E_PORT = 3001;

function readSupabaseKeys(): { url: string; anonKey: string; serviceRoleKey: string } {
	if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY) {
		return {
			url: process.env.SUPABASE_URL,
			anonKey: process.env.SUPABASE_ANON_KEY,
			serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
		};
	}
	const envTestPath = path.resolve(__dirname, "../.env.test");
	const parsed = loadDotenv({ path: envTestPath, override: false }).parsed ?? {};
	const url = parsed.SUPABASE_URL ?? process.env.SUPABASE_URL;
	const anonKey = parsed.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
	const serviceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !anonKey || !serviceRoleKey) {
		throw new Error(
			"Missing Supabase keys. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY " +
				"in environment or in .env.test.",
		);
	}
	return { url, anonKey, serviceRoleKey };
}

const keys = readSupabaseKeys();
export const SUPABASE_URL = keys.url;
export const ANON_KEY = keys.anonKey;
export const APP_URL = process.env.APP_URL ?? `http://localhost:${E2E_PORT}`;

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
		password: E2E_TEST_PASSWORD,
		email_confirm: true,
	});
	if (error) {
		const msg = error.message.toLowerCase();
		if (msg.includes("already") || msg.includes("database error")) {
			// Ensure password is set for users created by the old magic-link flow
			await adminClient().auth.admin.updateUserById(id, {
				password: E2E_TEST_PASSWORD,
			});
			return id;
		}
		throw new Error(`Failed to create auth user for ${persona.key}: ${error.message}`);
	}
	return id;
}

type CookieResult = Array<{ name: string; value: string; url: string }>;

interface SessionCache {
	generatedAt: number;
	sessions: Record<string, CookieResult>;
}

const CACHE_FILE = path.join(__dirname, ".session-cache.json");
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 min (sessions last 1hr; refresh early)

function readCache(): SessionCache | null {
	if (!fs.existsSync(CACHE_FILE)) return null;
	try {
		const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
		if (typeof raw.generatedAt === "number" && raw.sessions) return raw as SessionCache;
	} catch {
		/* corrupted or old-format cache — ignore */
	}
	return null;
}

export async function getSessionCookies(personaKey: string): Promise<CookieResult> {
	const cache = readCache();
	if (cache && Date.now() - cache.generatedAt < CACHE_TTL_MS && cache.sessions[personaKey]) {
		return cache.sessions[personaKey];
	}
	return generateFreshSessionCookies(personaKey);
}

export async function warmSessionCache(personaKeys: string[]): Promise<void> {
	const sessions: Record<string, CookieResult> = {};
	for (const key of personaKeys) {
		sessions[key] = await generateFreshSessionCookies(key);
	}
	const cache: SessionCache = { generatedAt: Date.now(), sessions };
	fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), "utf-8");
}

export async function generateFreshSessionCookies(personaKey: string): Promise<CookieResult> {
	const persona = personaByKey(personaKey);
	if (!persona.email) throw new Error(`Cannot create session for anonymous persona "${personaKey}"`);

	await ensureAuthUser(persona);

	const captured: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
	const ssrClient = createServerClient(SUPABASE_URL, ANON_KEY, {
		cookies: {
			getAll: () => [],
			setAll: (cookies) => {
				captured.push(...cookies);
			},
		},
	});

	const { error } = await ssrClient.auth.signInWithPassword({
		email: persona.email,
		password: E2E_TEST_PASSWORD,
	});
	if (error) {
		throw new Error(`Failed to sign in as ${personaKey}: ${error.message}`);
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

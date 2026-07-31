// Stand-in for `@/lib/supabase/server`'s `createClient`: a real postgrest-js
// client at the PostgREST sidecar, carrying a self-signed persona JWT. Set the
// active persona per-test with setPersona(); setup.ts wires this in via vi.mock.

import { createHmac } from "node:crypto";
import { v5 as uuidv5 } from "uuid";
import { PostgrestClient } from "@supabase/postgrest-js";
import { personaByKey } from "../../../tests/fixtures/personas";
import type { PersonaKey } from "../../../tests/fixtures/types";

const POSTGREST_URL = process.env.POSTGREST_URL ?? "http://127.0.0.1:3001";
const JWT_SECRET =
	process.env.SUPABASE_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";

const AUTH_UUID_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

let activePersona: PersonaKey = "anonymous";

export function setPersona(key: PersonaKey): void {
	activePersona = key;
}

function base64url(value: object): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function mintJwt(email: string): string {
	const header = base64url({ alg: "HS256", typ: "JWT" });
	const payload = base64url({ email, role: "authenticated", exp: 2_000_000_000 });
	const data = `${header}.${payload}`;
	const signature = createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
	return `${data}.${signature}`;
}

export function buildClientForActivePersona() {
	const persona = personaByKey(activePersona);
	const headers: Record<string, string> = {};
	let authUser: { id: string; email: string } | null = null;

	if (activePersona !== "anonymous" && persona.email) {
		headers.Authorization = `Bearer ${mintJwt(persona.email)}`;
		authUser = { id: uuidv5(persona.email, AUTH_UUID_NAMESPACE), email: persona.email };
	}

	const rest = new PostgrestClient(POSTGREST_URL, { headers });

	return {
		from: rest.from.bind(rest),
		rpc: rest.rpc.bind(rest),
		schema: rest.schema.bind(rest),
		storage: {
			from: (bucket: string) => ({
				getPublicUrl: (path: string) => ({
					data: { publicUrl: `${POSTGREST_URL}/storage/v1/object/public/${bucket}/${path}` },
				}),
			}),
		},
		auth: {
			getUser: async () => ({ data: { user: authUser }, error: null }),
			signOut: async () => ({ error: null }),
		},
	};
}

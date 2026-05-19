import { Client } from "pg";
import { personaByKey } from "../../tests/fixtures/personas";
import type { PersonaKey } from "../../tests/fixtures/types";

const DB_URL =
	process.env.SUPABASE_DB_URL ?? "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";

const PATCH_AUTH_EMAIL = `
CREATE OR REPLACE FUNCTION auth.email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
	SELECT (current_setting('request.jwt.claims', true)::json ->> 'email')::text;
$$;
`;

let patchApplied = false;

export type PersonaPgClient = {
	query: Client["query"];
	end: () => Promise<void>;
};

export async function pgClientAsPersona(key: PersonaKey): Promise<PersonaPgClient> {
	const persona = personaByKey(key);
	const client = new Client({ connectionString: DB_URL });
	await client.connect();

	if (!patchApplied) {
		await client.query(PATCH_AUTH_EMAIL);
		patchApplied = true;
	}

	if (key === "anonymous") {
		await client.query("SET ROLE anon");
		return wrap(client);
	}

	if (!persona.email) {
		throw new Error(`Persona ${key} has no email; cannot impersonate authenticated`);
	}

	const claims = JSON.stringify({ email: persona.email, role: "authenticated" });
	await client.query("SELECT set_config('request.jwt.claims', $1, false)", [claims]);
	await client.query("SET ROLE authenticated");

	return wrap(client);
}

function wrap(client: Client): PersonaPgClient {
	return {
		query: client.query.bind(client),
		end: async () => {
			try {
				await client.query("RESET ROLE");
				await client.query("SELECT set_config('request.jwt.claims', '', false)");
			} finally {
				await client.end();
			}
		},
	};
}

import { describe, expect, it } from "vitest";
import { pgClientAsPersona } from "../../../src/test-utils/pg-client";
import { authenticatedPersonas } from "../../fixtures/personas";

describe("authenticated_user_info derived flags match personas.ts expectations", () => {
	for (const persona of authenticatedPersonas()) {
		it(`${persona.key} (${persona.email})`, async () => {
			const client = await pgClientAsPersona(persona.key);
			try {
				const result = await client.query(
					"SELECT is_admin, is_jcrc, is_culture_sports_admin FROM authenticated_user_info",
				);
				expect(result.rows).toHaveLength(1);
				const row = result.rows[0];
				expect({
					is_admin: row.is_admin,
					is_jcrc: row.is_jcrc,
					is_culture_sports_admin: row.is_culture_sports_admin,
				}).toEqual(persona.expected);
			} finally {
				await client.end();
			}
		});
	}

	it("anonymous cannot read from authenticated_user_info", async () => {
		// The view's WHERE clause invokes internal.auth_user_id(), which only
		// grants EXECUTE to the `authenticated` role. As `anon`, the query
		// raises "permission denied for function auth_user_id" — the view is
		// effectively inaccessible to anonymous sessions, which matches the
		// production intent (anonymous users never resolve to a profile row).
		const client = await pgClientAsPersona("anonymous");
		try {
			await expect(
				client.query("SELECT * FROM authenticated_user_info"),
			).rejects.toThrow(/permission denied for function auth_user_id/);
		} finally {
			await client.end();
		}
	});
});

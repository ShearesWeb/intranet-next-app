import { afterEach, describe, expect, it } from "vitest";
import { pgClientAsPersona, type PersonaPgClient } from "../../../src/test-utils/pg-client";
import { userIdByEmail } from "../../../src/test-utils/factories";

// RLS + column-grant isolation on the `users` table.
//
// Policies (vendor/intranet/db/changelogs/security/core/02.user.sql):
//   - select_own_user / select_authenticated_user: authenticated may SELECT any
//     row (USING true) but only the directory column projection is GRANTed.
//   - select_anon_user: anon may SELECT (USING true) but only (id, name,
//     profile_photo_path) columns are GRANTed.
//   - update_own_user: a row is updatable only when auth_user_id() = id.
//
// The local DB enforces the column-level GRANT/REVOKE on users (verified live),
// so we assert the real anon projection here.

describe("users RLS — column projection + row-update isolation", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	it("anon may SELECT only (id, name, profile_photo_path)", async () => {
		client = await pgClientAsPersona("anonymous");
		const ok = await client.query("SELECT id, name, profile_photo_path FROM users");
		expect(ok.rows.length).toBeGreaterThan(0);
	});

	it("anon is DENIED the email column", async () => {
		client = await pgClientAsPersona("anonymous");
		await expect(client.query("SELECT email FROM users LIMIT 1")).rejects.toThrow(
			/permission denied for table users/,
		);
	});

	it("anon is DENIED the telegram_handle column", async () => {
		client = await pgClientAsPersona("anonymous");
		await expect(client.query("SELECT telegram_handle FROM users LIMIT 1")).rejects.toThrow(
			/permission denied for table users/,
		);
	});

	it("authenticated may read the directory columns (email, telegram_handle)", async () => {
		client = await pgClientAsPersona("aria");
		const r = await client.query(
			"SELECT id, email, telegram_handle FROM users WHERE email = $1",
			["aria.tan.sg@gmail.com"],
		);
		expect(r.rows).toHaveLength(1);
		expect(r.rows[0].email).toBe("aria.tan.sg@gmail.com");
	});

	it("authenticated is DENIED expo_push_token (not in directory projection)", async () => {
		client = await pgClientAsPersona("aria");
		await expect(client.query("SELECT expo_push_token FROM users LIMIT 1")).rejects.toThrow(
			/permission denied for table users/,
		);
	});

	it("a persona can UPDATE their OWN row", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const r = await client.query(
				"UPDATE users SET display_name = 'Declan!' WHERE email = $1",
				["declanho.sg@gmail.com"],
			);
			expect(r.rowCount).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a persona CANNOT UPDATE another persona's row (update_own filters it out)", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const r = await client.query(
				"UPDATE users SET display_name = 'HACKED' WHERE email = $1",
				["aria.tan.sg@gmail.com"],
			);
			// USING(auth_user_id() = id) makes the target row invisible to the
			// UPDATE — zero rows affected, no error, no mutation.
			expect(r.rowCount).toBe(0);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("auth_user_id resolves the caller's own row id (no cross-session bleed)", async () => {
		const declan = await pgClientAsPersona("declan");
		try {
			const expected = await userIdByEmail(declan, "declanho.sg@gmail.com");
			const r = await declan.query("SELECT internal.auth_user_id() AS uid");
			expect(r.rows[0].uid).toBe(expected);
		} finally {
			await declan.end();
		}
	});
});

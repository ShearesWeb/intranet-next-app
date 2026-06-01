import { afterEach, describe, expect, it } from "vitest";
import { pgClientAsPersona, type PersonaPgClient } from "../../../src/test-utils/pg-client";

// public_user_info (view/core/01): anon-safe projection — exactly
//   (id, name, profile_photo_path). GRANT SELECT to anon, authenticated.
//
// authenticated_user_directory (view/core/05): identity columns for the
//   directory — (id, email, name, room, telegram_handle, profile_photo_path).
//   GRANT SELECT to authenticated only.
//
// Both are security_invoker views, so underlying users RLS (USING true for both
// roles) lets the projection cover every user row — the *columns* are the gate.

async function viewColumns(client: PersonaPgClient, view: string): Promise<string[]> {
	const r = await client.query(
		`SELECT column_name FROM information_schema.columns
		  WHERE table_schema = 'public' AND table_name = $1
		  ORDER BY ordinal_position`,
		[view],
	);
	return r.rows.map((row) => row.column_name as string);
}

describe("public_user_info — anon-safe projection", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	it("exposes exactly (id, name, profile_photo_path)", async () => {
		client = await pgClientAsPersona("anonymous");
		const cols = await viewColumns(client, "public_user_info");
		expect(cols).toEqual(["id", "name", "profile_photo_path"]);
	});

	it("anon can read every user's public projection", async () => {
		client = await pgClientAsPersona("anonymous");
		const r = await client.query("SELECT id, name FROM public_user_info");
		expect(r.rows.length).toBeGreaterThan(0);
		// The view must not expose any sensitive column.
		await expect(client.query("SELECT email FROM public_user_info LIMIT 1")).rejects.toThrow(
			/column .*email.* does not exist/,
		);
	});

	it("authenticated can also read public_user_info", async () => {
		client = await pgClientAsPersona("aria");
		const r = await client.query("SELECT count(*)::int AS n FROM public_user_info");
		expect(r.rows[0].n).toBeGreaterThan(0);
	});
});

describe("authenticated_user_directory — directory projection", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	it("exposes the directory identity columns (and no expo_push_token)", async () => {
		client = await pgClientAsPersona("aria");
		const cols = await viewColumns(client, "authenticated_user_directory");
		expect(cols.sort()).toEqual(
			["email", "id", "name", "profile_photo_path", "room", "telegram_handle"].sort(),
		);
		expect(cols).not.toContain("expo_push_token");
	});

	it("an authenticated persona can read directory rows for all users", async () => {
		client = await pgClientAsPersona("aria");
		const r = await client.query(
			"SELECT email FROM authenticated_user_directory WHERE email = $1",
			["declanho.sg@gmail.com"],
		);
		expect(r.rows).toHaveLength(1);
	});

	it("anon CANNOT read authenticated_user_directory (no grant)", async () => {
		client = await pgClientAsPersona("anonymous");
		await expect(
			client.query("SELECT * FROM authenticated_user_directory LIMIT 1"),
		).rejects.toThrow(/permission denied/);
	});
});

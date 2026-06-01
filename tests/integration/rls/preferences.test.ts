import { afterEach, describe, expect, it } from "vitest";
import { pgClientAsPersona, type PersonaPgClient } from "../../../src/test-utils/pg-client";
import { asOwner, positionId, userIdByEmail } from "../../../src/test-utils/factories";

// RLS isolation on the two preference tables.
//
// cca_user_preferences (security/cca-allocation/01): user-only double-blind
//   market — SELECT/INSERT/UPDATE/DELETE all gated on user_id = auth_user_id().
//
// cca_position_preferences (security/cca-allocation/02): chain-of-managers —
//   all ops gated on can_manage_cca_appointments(position_id, auth_user_id()).
//
// Each mutating test runs in BEGIN/ROLLBACK so the seeded DB is untouched.

describe("cca_user_preferences RLS — own-row only (double-blind)", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	it("a persona SELECTs only their own preferences, never another's", async () => {
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const masonId = await userIdByEmail(client, "mason.lim.99@gmail.com");
			const chloeId = await userIdByEmail(client, "chloe.ng.j@gmail.com");
			const pos = await positionId(client, "Volleyball", "Player");

			// Seed one row for mason and one for chloe as the table owner.
			await asOwner(client, "mason.lim.99@gmail.com", async () => {
				await client!.query(
					"INSERT INTO cca_user_preferences (user_id, position_id, rank) VALUES ($1, $2, 1)",
					[masonId, pos],
				);
				await client!.query(
					"INSERT INTO cca_user_preferences (user_id, position_id, rank) VALUES ($1, $2, 2)",
					[chloeId, pos],
				);
			});

			const all = await client.query("SELECT user_id FROM cca_user_preferences");
			expect(all.rows).toHaveLength(1);
			expect(all.rows[0].user_id).toBe(masonId);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a persona CANNOT INSERT a preference owned by someone else", async () => {
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const chloeId = await userIdByEmail(client, "chloe.ng.j@gmail.com");
			const pos = await positionId(client, "Volleyball", "Player");
			await expect(
				client.query(
					"INSERT INTO cca_user_preferences (user_id, position_id, rank) VALUES ($1, $2, 1)",
					[chloeId, pos],
				),
			).rejects.toThrow(/row-level security policy/);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a persona CANNOT UPDATE or DELETE another persona's preference", async () => {
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const chloeId = await userIdByEmail(client, "chloe.ng.j@gmail.com");
			const pos = await positionId(client, "Volleyball", "Player");
			await asOwner(client, "mason.lim.99@gmail.com", async () => {
				await client!.query(
					"INSERT INTO cca_user_preferences (user_id, position_id, rank) VALUES ($1, $2, 5)",
					[chloeId, pos],
				);
			});
			const upd = await client.query(
				"UPDATE cca_user_preferences SET rank = 99 WHERE user_id = $1",
				[chloeId],
			);
			expect(upd.rowCount).toBe(0);
			const del = await client.query("DELETE FROM cca_user_preferences WHERE user_id = $1", [
				chloeId,
			]);
			expect(del.rowCount).toBe(0);
		} finally {
			await client.query("ROLLBACK");
		}
	});
});

describe("cca_position_preferences RLS — chain-of-managers only", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	it("a chair CAN INSERT a position preference for a position they manage", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const masonId = await userIdByEmail(client, "mason.lim.99@gmail.com");
			const pos = await positionId(client, "Volleyball", "Player");
			const r = await client.query(
				"INSERT INTO cca_position_preferences (position_id, user_id, rank) VALUES ($1, $2, 1)",
				[pos, masonId],
			);
			expect(r.rowCount).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a non-manager CANNOT INSERT a position preference", async () => {
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const chloeId = await userIdByEmail(client, "chloe.ng.j@gmail.com");
			const pos = await positionId(client, "Volleyball", "Player");
			await expect(
				client.query(
					"INSERT INTO cca_position_preferences (position_id, user_id, rank) VALUES ($1, $2, 1)",
					[pos, chloeId],
				),
			).rejects.toThrow(/row-level security policy/);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a non-manager SELECTs no position preferences (chain-of-managers gate)", async () => {
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const masonId = await userIdByEmail(client, "mason.lim.99@gmail.com");
			const pos = await positionId(client, "Volleyball", "Player");
			await asOwner(client, "mason.lim.99@gmail.com", async () => {
				await client!.query(
					"INSERT INTO cca_position_preferences (position_id, user_id, rank) VALUES ($1, $2, 1)",
					[pos, masonId],
				);
			});
			const r = await client.query("SELECT count(*)::int AS n FROM cca_position_preferences");
			expect(r.rows[0].n).toBe(0);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a chair of CCA-A CANNOT INSERT a position preference in CCA-B", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const ariaId = await userIdByEmail(client, "aria.tan.sg@gmail.com");
			const otherPos = await positionId(client, "Basketball", "Player");
			await expect(
				client.query(
					"INSERT INTO cca_position_preferences (position_id, user_id, rank) VALUES ($1, $2, 1)",
					[otherPos, ariaId],
				),
			).rejects.toThrow(/row-level security policy/);
		} finally {
			await client.query("ROLLBACK");
		}
	});
});

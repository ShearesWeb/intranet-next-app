import { afterEach, describe, expect, it } from "vitest";
import { pgClientAsPersona, type PersonaPgClient } from "../../../src/test-utils/pg-client";
import { positionId, userIdByEmail } from "../../../src/test-utils/factories";

// RLS isolation on cca_appointments
// (vendor/intranet/db/changelogs/security/core/05.cca-appointment.sql):
//   - select_all: SELECT is public (USING true).
//   - insert/update/delete_authenticated: gated on
//     internal.can_manage_cca_appointments(position_id, auth_user_id()), i.e.
//     the caller must hold a position UPSTREAM of the target in the same CCA's
//     reporting chain.
//
// declan is Volleyball Captain (lead) → manages Volleyball Vice/TM/Player.
// nova is Basketball Captain (lead)  → manages Basketball positions only.
// mason is a Volleyball Player (member, leaf) → manages nobody.

describe("cca_appointments RLS — manage-chain write isolation", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	it("SELECT on appointments is public to authenticated personas", async () => {
		client = await pgClientAsPersona("mason");
		const r = await client.query("SELECT count(*)::int AS n FROM cca_appointments");
		expect(r.rows[0].n).toBeGreaterThan(0);
	});

	it("a chair CAN INSERT an appointment for a position they manage", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const ariaId = await userIdByEmail(client, "aria.tan.sg@gmail.com");
			const playerPos = await positionId(client, "Volleyball", "Player");
			const r = await client.query(
				"INSERT INTO cca_appointments (user_id, position_id) VALUES ($1, $2)",
				[ariaId, playerPos],
			);
			expect(r.rowCount).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a chair CANNOT INSERT into a CCA they do not manage (cross-CCA isolation)", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const ariaId = await userIdByEmail(client, "aria.tan.sg@gmail.com");
			const otherCcaPos = await positionId(client, "Basketball", "Player");
			await expect(
				client.query("INSERT INTO cca_appointments (user_id, position_id) VALUES ($1, $2)", [
					ariaId,
					otherCcaPos,
				]),
			).rejects.toThrow(/row-level security policy/);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a member (leaf) CANNOT DELETE another member's appointment", async () => {
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const chloeId = await userIdByEmail(client, "chloe.ng.j@gmail.com");
			const tmPos = await positionId(client, "Volleyball", "Team Manager");
			const r = await client.query(
				"DELETE FROM cca_appointments WHERE user_id = $1 AND position_id = $2",
				[chloeId, tmPos],
			);
			// USING(can_manage...) is false for mason → row invisible → 0 deleted.
			expect(r.rowCount).toBe(0);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a chair of CCA-A CANNOT DELETE an appointment in CCA-B", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const novaId = await userIdByEmail(client, "nova.tay.sg@gmail.com");
			const bballCaptain = await positionId(client, "Basketball", "Captain");
			const r = await client.query(
				"DELETE FROM cca_appointments WHERE user_id = $1 AND position_id = $2",
				[novaId, bballCaptain],
			);
			expect(r.rowCount).toBe(0);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a chair CAN INSERT then DELETE within their own managed CCA", async () => {
		client = await pgClientAsPersona("nova");
		await client.query("BEGIN");
		try {
			const ariaId = await userIdByEmail(client, "aria.tan.sg@gmail.com");
			const bballPlayer = await positionId(client, "Basketball", "Player");
			const ins = await client.query(
				"INSERT INTO cca_appointments (user_id, position_id) VALUES ($1, $2)",
				[ariaId, bballPlayer],
			);
			expect(ins.rowCount).toBe(1);
			const del = await client.query(
				"DELETE FROM cca_appointments WHERE user_id = $1 AND position_id = $2",
				[ariaId, bballPlayer],
			);
			expect(del.rowCount).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});
});

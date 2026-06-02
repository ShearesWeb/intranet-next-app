import { afterEach, describe, expect, it } from "vitest";
import { pgClientAsPersona, type PersonaPgClient } from "../../../src/test-utils/pg-client";
import {
	asOwner,
	insertSubsidyEnvelope,
	insertUserSubsidy,
	positionId,
	userIdByEmail,
} from "../../../src/test-utils/factories";

// RLS isolation on the subsidy tables.
//
// cca_subsidies (security/subsidy/01):
//   SELECT/UPDATE: can_manage(position_id) OR is_jcrc
//   INSERT/DELETE: can_manage(position_id) only
//
// cca_user_subsidies (security/subsidy/02):
//   SELECT: own row OR can_manage(parent.position_id) OR is_jcrc
//   INSERT/DELETE: can_manage(parent.position_id) only
//
// declan manages Volleyball; jasper is JCRC (is_jcrc); mason is a plain member.
// A trigger requires the parent envelope be 'approved' before a user-subsidy
// row may be inserted, so the user-subsidy seeds use status='approved'.

describe("cca_subsidies RLS — manage-chain + JCRC isolation", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	it("a chair CAN INSERT a subsidy envelope for a position they manage", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const pos = await positionId(client, "Volleyball", "Player");
			const r = await client.query(
				"INSERT INTO cca_subsidies (position_id, day, hours) VALUES ($1, '2026-01-10', 3)",
				[pos],
			);
			expect(r.rowCount).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a plain member CANNOT INSERT a subsidy envelope", async () => {
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const pos = await positionId(client, "Volleyball", "Player");
			await expect(
				client.query(
					"INSERT INTO cca_subsidies (position_id, day, hours) VALUES ($1, '2026-01-10', 3)",
					[pos],
				),
			).rejects.toThrow(/row-level security policy/);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("a chair SELECTs their managed envelope; an unrelated member sees nothing", async () => {
		// declan's view
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const pos = await positionId(client, "Volleyball", "Player");
			const declanId = await userIdByEmail(client, "declanho.sg@gmail.com");
			await asOwner(client, "declanho.sg@gmail.com", async () => {
				await insertSubsidyEnvelope(client!, { positionId: pos, createdBy: declanId });
			});
			const r = await client.query("SELECT count(*)::int AS n FROM cca_subsidies WHERE position_id = $1", [pos]);
			expect(r.rows[0].n).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
		await client.end();
		client = null;

		// mason (unrelated member) view of the same kind of envelope
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const pos = await positionId(client, "Volleyball", "Player");
			const declanId = await userIdByEmail(client, "declanho.sg@gmail.com");
			await asOwner(client, "mason.lim.99@gmail.com", async () => {
				await insertSubsidyEnvelope(client!, { positionId: pos, createdBy: declanId });
			});
			const r = await client.query("SELECT count(*)::int AS n FROM cca_subsidies WHERE position_id = $1", [pos]);
			expect(r.rows[0].n).toBe(0);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("JCRC can SELECT a subsidy envelope it does not manage (is_jcrc gate)", async () => {
		client = await pgClientAsPersona("jasper");
		await client.query("BEGIN");
		try {
			const pos = await positionId(client, "Volleyball", "Player");
			const declanId = await userIdByEmail(client, "declanho.sg@gmail.com");
			await asOwner(client, "jasper.chua.sg@gmail.com", async () => {
				await insertSubsidyEnvelope(client!, { positionId: pos, createdBy: declanId });
			});
			const r = await client.query("SELECT count(*)::int AS n FROM cca_subsidies WHERE position_id = $1", [pos]);
			expect(r.rows[0].n).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("JCRC CANNOT INSERT a subsidy envelope it does not manage (INSERT is manage-only)", async () => {
		client = await pgClientAsPersona("jasper");
		await client.query("BEGIN");
		try {
			const pos = await positionId(client, "Volleyball", "Player");
			await expect(
				client.query(
					"INSERT INTO cca_subsidies (position_id, day, hours) VALUES ($1, '2026-01-10', 3)",
					[pos],
				),
			).rejects.toThrow(/row-level security policy/);
		} finally {
			await client.query("ROLLBACK");
		}
	});
});

describe("cca_user_subsidies RLS — own/manage/JCRC SELECT isolation", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	// Helper: seed an approved envelope + one user-subsidy for `subjectEmail`,
	// all as the table owner inside the current transaction.
	async function seedUserSubsidy(
		c: PersonaPgClient,
		personaEmail: string,
		subjectEmail: string,
	): Promise<{ subjectId: number }> {
		const pos = await positionId(c, "Volleyball", "Player");
		const declanId = await userIdByEmail(c, "declanho.sg@gmail.com");
		const subjectId = await userIdByEmail(c, subjectEmail);
		await asOwner(c, personaEmail, async () => {
			const envId = await insertSubsidyEnvelope(c, {
				positionId: pos,
				createdBy: declanId,
				status: "approved",
			});
			await insertUserSubsidy(c, { subsidyId: envId, userId: subjectId, createdBy: declanId });
		});
		return { subjectId };
	}

	it("the subject user SEES their own user-subsidy row", async () => {
		client = await pgClientAsPersona("mason");
		await client.query("BEGIN");
		try {
			const { subjectId } = await seedUserSubsidy(
				client,
				"mason.lim.99@gmail.com",
				"mason.lim.99@gmail.com",
			);
			const r = await client.query(
				"SELECT count(*)::int AS n FROM cca_user_subsidies WHERE user_id = $1",
				[subjectId],
			);
			expect(r.rows[0].n).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("an unrelated member does NOT see another user's user-subsidy row", async () => {
		client = await pgClientAsPersona("chloe");
		await client.query("BEGIN");
		try {
			// subject is mason; the caller chloe is neither subject, manager, nor JCRC.
			const { subjectId } = await seedUserSubsidy(
				client,
				"chloe.ng.j@gmail.com",
				"mason.lim.99@gmail.com",
			);
			const r = await client.query(
				"SELECT count(*)::int AS n FROM cca_user_subsidies WHERE user_id = $1",
				[subjectId],
			);
			expect(r.rows[0].n).toBe(0);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("the managing chair SEES a subject's user-subsidy row", async () => {
		client = await pgClientAsPersona("declan");
		await client.query("BEGIN");
		try {
			const { subjectId } = await seedUserSubsidy(
				client,
				"declanho.sg@gmail.com",
				"mason.lim.99@gmail.com",
			);
			const r = await client.query(
				"SELECT count(*)::int AS n FROM cca_user_subsidies WHERE user_id = $1",
				[subjectId],
			);
			expect(r.rows[0].n).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});

	it("JCRC SEES a subject's user-subsidy row (is_jcrc gate)", async () => {
		client = await pgClientAsPersona("jasper");
		await client.query("BEGIN");
		try {
			const { subjectId } = await seedUserSubsidy(
				client,
				"jasper.chua.sg@gmail.com",
				"mason.lim.99@gmail.com",
			);
			const r = await client.query(
				"SELECT count(*)::int AS n FROM cca_user_subsidies WHERE user_id = $1",
				[subjectId],
			);
			expect(r.rows[0].n).toBe(1);
		} finally {
			await client.query("ROLLBACK");
		}
	});
});

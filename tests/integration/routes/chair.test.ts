import { describe, expect, it } from "vitest";
import { asPersona, ccaIdByName, jsonRequest, readJson, routeParams } from "../helpers";
import { pgPool } from "../setup";
import type { Position } from "@/types/applicants";

async function positionIdFor(ccaName: string, positionType: string): Promise<number> {
	const r = await pgPool.query(
		`SELECT cp.id
		   FROM cca_positions cp
		   JOIN ccas c ON c.id = cp.cca_id
		  WHERE c.name = $1 AND cp.position_type = $2
		  ORDER BY cp.id
		  LIMIT 1`,
		[ccaName, positionType],
	);
	if (!r.rows[0]) throw new Error(`No ${positionType} position in CCA "${ccaName}"`);
	return r.rows[0].id as number;
}

async function userIdByEmail(email: string): Promise<number> {
	const r = await pgPool.query("SELECT id FROM users WHERE email = $1", [email]);
	if (!r.rows[0]) throw new Error(`No user with email "${email}"`);
	return r.rows[0].id as number;
}

// GET /api/chair/positions/for-chair — positions visible to the calling chair.
describe("GET /api/chair/positions/for-chair", () => {
	it("returns a result for a chair (declan)", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/chair/positions/for-chair/route");
		const { status, error } = await readJson(await GET());
		expect(status).toBe(200);
		expect(error).toBeNull();
	});

	// The chair's list is preferred_candidates alone: a candidate the chair adds
	// must read back from it, complete with display fields from `users`.
	it("lists a chair-added candidate", async () => {
		const positionId = await positionIdFor("SHWEB", "maincomm");
		const userId = await userIdByEmail("aria.tan.sg@gmail.com");

		asPersona("layla");
		const { POST } = await import("@/app/api/chair/positions/[position-id]/applicants/route");
		const added = await readJson(
			await POST(
				jsonRequest(`/api/chair/positions/${positionId}/applicants`, "POST", { user_id: userId }),
				routeParams({ "position-id": String(positionId) }),
			),
		);
		expect(added.status).toBe(200);

		const { GET } = await import("@/app/api/chair/positions/for-chair/route");
		const { data } = await readJson<{ positions: Position[] }>(await GET());
		const position = data.positions.find((p) => p.id === positionId);
		const candidate = position?.applicants.find((a) => a.id === userId);

		expect(candidate).toBeDefined();
		expect(candidate?.ranking).toBe(1);
		expect(candidate?.email).toBe("aria.tan.sg@gmail.com");
	});

	// Applications are private to the resident: a chair must never learn who
	// applied. Someone who applied but was never shortlisted stays invisible.
	it("does not surface a resident's application to the chair", async () => {
		const positionId = await positionIdFor("SHWEB", "maincomm");
		const userId = await userIdByEmail("aria.tan.sg@gmail.com");

		await pgPool.query(
			"INSERT INTO preferred_positions (user_id, position_id, rank) VALUES ($1, $2, 1)",
			[userId, positionId],
		);

		asPersona("layla");
		const { GET } = await import("@/app/api/chair/positions/for-chair/route");
		const { data } = await readJson<{ positions: Position[] }>(await GET());
		const position = data.positions.find((p) => p.id === positionId);

		expect(position).toBeDefined();
		expect(position?.applicants.some((a) => a.id === userId)).toBe(false);
	});

	// Removing a candidate from the ranking must survive a save + reload — even
	// when that resident also applied themselves (the original regression).
	it("keeps a removed candidate out of the list after a whole-list save", async () => {
		const positionId = await positionIdFor("SHWEB", "maincomm");
		const ariaId = await userIdByEmail("aria.tan.sg@gmail.com");
		const declanId = await userIdByEmail("declanho.sg@gmail.com");

		// Aria applied herself, and the chair had previously ranked both.
		await pgPool.query(
			"INSERT INTO preferred_positions (user_id, position_id, rank) VALUES ($1, $2, 1)",
			[ariaId, positionId],
		);

		asPersona("layla");
		const { POST: addCandidate } =
			await import("@/app/api/chair/positions/[position-id]/applicants/route");
		for (const userId of [ariaId, declanId]) {
			const { status } = await readJson(
				await addCandidate(
					jsonRequest(`/api/chair/positions/${positionId}/applicants`, "POST", {
						user_id: userId,
					}),
					routeParams({ "position-id": String(positionId) }),
				),
			);
			expect(status).toBe(200);
		}

		// The client save sequence for "remove aria, keep declan".
		const { DELETE } = await import("@/app/api/chair/positions/[position-id]/applicants/route");
		const removed = await readJson(
			await DELETE(
				jsonRequest(`/api/chair/positions/${positionId}/applicants`, "DELETE", {
					user_id: ariaId,
				}),
				routeParams({ "position-id": String(positionId) }),
			),
		);
		expect(removed.status).toBe(200);

		const { POST: rank } = await import("@/app/api/chair/positions/[position-id]/rank/route");
		const ranked = await readJson(
			await rank(
				jsonRequest(`/api/chair/positions/${positionId}/rank`, "POST", {
					rankings: [{ user_id: declanId, ranking: 1 }],
				}),
				routeParams({ "position-id": String(positionId) }),
			),
		);
		expect(ranked.status).toBe(200);

		const { GET } = await import("@/app/api/chair/positions/for-chair/route");
		const { data } = await readJson<{ positions: Position[] }>(await GET());
		const position = data.positions.find((p) => p.id === positionId);

		expect(position?.applicants.map((a) => a.id)).toEqual([declanId]);
	});

	// Only maincomm, blockcomm, and subcomm are allocation positions now, so a
	// sports chair's member and team-manager seats are outside chair ranking.
	it("403s a chair-add on member and team-manager positions", async () => {
		const userId = await userIdByEmail("aria.tan.sg@gmail.com");

		asPersona("declan");
		const { POST } = await import("@/app/api/chair/positions/[position-id]/applicants/route");
		for (const positionType of ["member", "team-manager"]) {
			const positionId = await positionIdFor("Volleyball", positionType);
			const { status } = await readJson(
				await POST(
					jsonRequest(`/api/chair/positions/${positionId}/applicants`, "POST", {
						user_id: userId,
					}),
					routeParams({ "position-id": String(positionId) }),
				),
			);
			expect(status).toBe(403);
		}
	});

	it("omits non-committee positions from a sports chair's list", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/chair/positions/for-chair/route");
		const { data } = await readJson<{ positions: Position[] }>(await GET());
		expect(data.positions).toEqual([]);
	});
});

// GET /api/cca/[cca-id]/rankings — member evaluation ranking.
//
// Skipped while `memberRanking` is parked. The schema dropped the evaluations
// domain, so `cca_appointment_evaluations` does not exist and the route is
// gated to 503. Unskip in the same change that restores the table and the flag.
describe.skip("GET /api/cca/[cca-id]/rankings", () => {
	it("404s for a non-existent CCA", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/cca/[cca-id]/rankings/route");
		const res = await GET(new Request("http://localhost/x"), routeParams({ "cca-id": "999999" }));
		expect(res.status).toBe(404);
	});

	it("serves the chair their CCA's rankings (declan / Volleyball)", async () => {
		asPersona("declan");
		const ccaId = await ccaIdByName("Volleyball");
		const { GET } = await import("@/app/api/cca/[cca-id]/rankings/route");
		const res = await GET(
			new Request("http://localhost/x"),
			routeParams({ "cca-id": String(ccaId) }),
		);
		expect(res.status).toBe(200);
	});

	it("denies a non-chair (aria) access to a CCA's rankings", async () => {
		asPersona("aria");
		const ccaId = await ccaIdByName("Volleyball");
		const { GET } = await import("@/app/api/cca/[cca-id]/rankings/route");
		const res = await GET(
			new Request("http://localhost/x"),
			routeParams({ "cca-id": String(ccaId) }),
		);
		expect(res.status).toBeGreaterThanOrEqual(401);
		expect(res.status).toBeLessThan(500);
	});
});

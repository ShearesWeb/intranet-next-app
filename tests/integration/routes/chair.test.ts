import { describe, expect, it } from "vitest";
import { asPersona, ccaIdByName, jsonRequest, readJson, routeParams } from "../helpers";
import { pgPool } from "../setup";
import type { Position } from "@/types/applicants";

// GET /api/chair/positions/for-chair — positions visible to the calling chair.
describe("GET /api/chair/positions/for-chair", () => {
	it("returns a result for a chair (declan)", async () => {
		asPersona("declan");
		const { GET } = await import("@/app/api/chair/positions/for-chair/route");
		const { status, error } = await readJson(await GET());
		expect(status).toBe(200);
		expect(error).toBeNull();
	});

	// A chair may shortlist a resident who never applied. That candidate lives in
	// preferred_candidates only, so a roster read that covers preferred_positions
	// alone loses them: they vanish from the list and the next whole-list write
	// deletes them.
	it("lists a chair-added candidate who never applied", async () => {
		const positionId = (
			await pgPool.query(
				`SELECT cp.id
				   FROM cca_positions cp
				   JOIN ccas c ON c.id = cp.cca_id
				  WHERE c.name = 'SHWEB' AND cp.position_type = 'maincomm'
				  ORDER BY cp.id
				  LIMIT 1`,
			)
		).rows[0].id as number;
		const userId = (
			await pgPool.query("SELECT id FROM users WHERE email = 'aria.tan.sg@gmail.com'")
		).rows[0].id as number;

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
		expect(candidate?.applied).toBe(false);
		expect(candidate?.ranking).toBe(1);
		// She never applied, so she must not inflate the applicant count.
		expect(position?.applied_count).toBe(0);
	});

	// Only maincomm, blockcomm, and subcomm are allocation positions now, so a
	// sports chair's member seats are outside chair ranking entirely.
	it("403s a chair-add on a member position", async () => {
		const positionId = (
			await pgPool.query(
				`SELECT cp.id
				   FROM cca_positions cp
				   JOIN ccas c ON c.id = cp.cca_id
				  WHERE c.name = 'Volleyball' AND cp.position_type = 'member'
				  ORDER BY cp.id
				  LIMIT 1`,
			)
		).rows[0].id as number;
		const userId = (
			await pgPool.query("SELECT id FROM users WHERE email = 'aria.tan.sg@gmail.com'")
		).rows[0].id as number;

		asPersona("declan");
		const { POST } = await import("@/app/api/chair/positions/[position-id]/applicants/route");
		const { status } = await readJson(
			await POST(
				jsonRequest(`/api/chair/positions/${positionId}/applicants`, "POST", { user_id: userId }),
				routeParams({ "position-id": String(positionId) }),
			),
		);
		expect(status).toBe(403);
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

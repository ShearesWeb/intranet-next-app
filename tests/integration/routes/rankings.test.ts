import { describe, expect, it } from "vitest";
import { asPersona, jsonRequest, readJson } from "../helpers";
import { pgPool } from "../setup";

// POST /api/user/rankings — saves the caller's CCA preference ranking (mutation;
// the beforeEach reseed restores the baseline afterward).
describe("POST /api/user/rankings", () => {
	async function positionIds(): Promise<number[]> {
		const r = await pgPool.query(
			`SELECT cp.id
			   FROM cca_positions cp
			   JOIN ccas c ON c.id = cp.cca_id
			  WHERE c.name IN ('Choir', 'Dance') AND cp.position_type = 'member'
			  ORDER BY cp.id
			  LIMIT 2`,
		);
		return r.rows.map((row) => row.id as number);
	}

	it("persists the caller's preferences", async () => {
		asPersona("aria");
		const [p1, p2] = await positionIds();
		const { POST } = await import("@/app/api/user/rankings/route");
		const { status, data } = await readJson<{ success: boolean }>(
			await POST(
				jsonRequest("/api/user/rankings", "POST", {
					rankings: [
						{ position_id: p1, ranking: 1 },
						{ position_id: p2, ranking: 2 },
					],
				}),
			),
		);

		expect(status).toBe(200);
		expect(data.success).toBe(true);

		// The rows actually landed under aria's user id.
		const count = await pgPool.query(
			`SELECT count(*)::int AS n
			   FROM cca_user_preferences pref
			   JOIN users u ON u.id = pref.user_id
			  WHERE u.email = 'aria.tan.sg@gmail.com'`,
		);
		expect(count.rows[0].n).toBe(2);
	});

	it("400s on a malformed body", async () => {
		asPersona("aria");
		const { POST } = await import("@/app/api/user/rankings/route");
		const { status } = await readJson(
			await POST(jsonRequest("/api/user/rankings", "POST", { rankings: "nope" })),
		);
		expect(status).toBe(400);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { POST } = await import("@/app/api/user/rankings/route");
		const { status } = await readJson(
			await POST(jsonRequest("/api/user/rankings", "POST", { rankings: [] })),
		);
		expect(status).toBe(401);
	});
});

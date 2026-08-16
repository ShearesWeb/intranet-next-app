import { describe, expect, it } from "vitest";
import { asPersona, jsonRequest, readJson, setFeatureFlag } from "../helpers";
import { pgPool } from "../setup";

const HOUR_MS = 3_600_000;

async function positionId(ccaName: string, positionName: string): Promise<number> {
	const r = await pgPool.query(
		`SELECT cp.id
		   FROM cca_positions cp
		   JOIN ccas c ON c.id = cp.cca_id
		  WHERE c.name = $1 AND cp.name = $2`,
		[ccaName, positionName],
	);
	if (!r.rows[0]) throw new Error(`No position "${positionName}" in CCA "${ccaName}"`);
	return r.rows[0].id as number;
}

async function ariaRows(): Promise<{ position_id: number; rank: number }[]> {
	const rows = await pgPool.query(
		`SELECT pref.position_id, pref.rank
		   FROM preferred_positions pref
		   JOIN users u ON u.id = pref.user_id
		  WHERE u.email = 'aria.tan.sg@gmail.com'
		  ORDER BY pref.rank`,
	);
	return rows.rows;
}

// POST /api/user/rankings — saves the caller's CCA preference ranking, gated by
// the timed ranking-period flags (mutation; the beforeEach reseed restores the
// baseline and deletes the flag rows afterward).
describe("POST /api/user/rankings", () => {
	it("persists subcomm preferences while the subcomm period is open", async () => {
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		asPersona("aria");
		const p1 = await positionId("SHWEB", "Subcomm");
		const p2 = await positionId("SECC", "Subcomm");

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
		expect(await ariaRows()).toEqual([
			{ position_id: p1, rank: 1 },
			{ position_id: p2, rank: 2 },
		]);
	});

	it("reorders in place when the same list is sent in a new order", async () => {
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		asPersona("aria");
		const p1 = await positionId("SHWEB", "Subcomm");
		const p2 = await positionId("SECC", "Subcomm");
		const { POST } = await import("@/app/api/user/rankings/route");

		await POST(
			jsonRequest("/api/user/rankings", "POST", {
				rankings: [
					{ position_id: p1, ranking: 1 },
					{ position_id: p2, ranking: 2 },
				],
			}),
		);
		const { status } = await readJson(
			await POST(
				jsonRequest("/api/user/rankings", "POST", {
					rankings: [
						{ position_id: p2, ranking: 1 },
						{ position_id: p1, ranking: 2 },
					],
				}),
			),
		);
		expect(status).toBe(200);
		expect(await ariaRows()).toEqual([
			{ position_id: p2, rank: 1 },
			{ position_id: p1, rank: 2 },
		]);
	});

	it("clears the open-period list when sent an empty array", async () => {
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		asPersona("aria");
		const p1 = await positionId("SHWEB", "Subcomm");
		const { POST } = await import("@/app/api/user/rankings/route");

		await POST(
			jsonRequest("/api/user/rankings", "POST", {
				rankings: [{ position_id: p1, ranking: 1 }],
			}),
		);
		const { status } = await readJson(
			await POST(jsonRequest("/api/user/rankings", "POST", { rankings: [] })),
		);
		expect(status).toBe(200);
		expect(await ariaRows()).toEqual([]);
	});

	it("403s when every ranking period is closed", async () => {
		asPersona("aria");
		const p1 = await positionId("SHWEB", "Subcomm");
		const { POST } = await import("@/app/api/user/rankings/route");
		const { status } = await readJson(
			await POST(
				jsonRequest("/api/user/rankings", "POST", {
					rankings: [{ position_id: p1, ranking: 1 }],
				}),
			),
		);
		expect(status).toBe(403);
		expect(await ariaRows()).toEqual([]);
	});

	it("403s once the window has expired, even with the flag still enabled", async () => {
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: -1000 });
		asPersona("aria");
		const p1 = await positionId("SHWEB", "Subcomm");
		const { POST } = await import("@/app/api/user/rankings/route");
		const { status } = await readJson(
			await POST(
				jsonRequest("/api/user/rankings", "POST", {
					rankings: [{ position_id: p1, ranking: 1 }],
				}),
			),
		);
		expect(status).toBe(403);
	});

	it("403s before a scheduled window has started", async () => {
		await setFeatureFlag("subcomm-ranking-period", {
			enabled: true,
			startsInMs: HOUR_MS,
			expiresInMs: 2 * HOUR_MS,
		});
		asPersona("aria");
		const p1 = await positionId("SHWEB", "Subcomm");
		const { POST } = await import("@/app/api/user/rankings/route");
		const { status } = await readJson(
			await POST(
				jsonRequest("/api/user/rankings", "POST", {
					rankings: [{ position_id: p1, ranking: 1 }],
				}),
			),
		);
		expect(status).toBe(403);
	});

	it("403s a maincomm position while only the subcomm period is open", async () => {
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		asPersona("aria");
		const maincomm = await positionId("SHWEB", "Maincomm");
		const { POST } = await import("@/app/api/user/rankings/route");
		const { status } = await readJson(
			await POST(
				jsonRequest("/api/user/rankings", "POST", {
					rankings: [{ position_id: maincomm, ranking: 1 }],
				}),
			),
		);
		expect(status).toBe(403);
		expect(await ariaRows()).toEqual([]);
	});

	it("carries locked maincomm rows over untouched when saving during the subcomm period", async () => {
		const { POST } = await import("@/app/api/user/rankings/route");
		asPersona("aria");
		const maincomm1 = await positionId("SHWEB", "Maincomm");
		const maincomm2 = await positionId("SECC", "Maincomm");
		const subcomm1 = await positionId("SHWEB", "Subcomm");

		// Maincomm period: save two maincomm preferences.
		await setFeatureFlag("maincomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		const first = await readJson(
			await POST(
				jsonRequest("/api/user/rankings", "POST", {
					rankings: [
						{ position_id: maincomm2, ranking: 1 },
						{ position_id: maincomm1, ranking: 2 },
					],
				}),
			),
		);
		expect(first.status).toBe(200);

		// Maincomm closes, subcomm opens; a subcomm save must not disturb the
		// locked rows and its entries rank after them.
		await setFeatureFlag("maincomm-ranking-period", { enabled: false });
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		const second = await readJson(
			await POST(
				jsonRequest("/api/user/rankings", "POST", {
					rankings: [{ position_id: subcomm1, ranking: 1 }],
				}),
			),
		);
		expect(second.status).toBe(200);

		expect(await ariaRows()).toEqual([
			{ position_id: maincomm2, rank: 1 },
			{ position_id: maincomm1, rank: 2 },
			{ position_id: subcomm1, rank: 3 },
		]);
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

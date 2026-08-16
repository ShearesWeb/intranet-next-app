import { describe, expect, it } from "vitest";
import { asPersona, jsonRequest, makeRequest, readJson, setFeatureFlag } from "../helpers";
import type { RankingPeriodState } from "@/lib/timed-flags/ranking-periods";
import type { TimedFlagRow } from "@/lib/timed-flags/window";
import type { RankablePosition, SavedPreference } from "@/lib/allocation/preference-service";

const HOUR_MS = 3_600_000;

// GET /api/feature-flags — raw timed-flag rows plus the server clock.
describe("GET /api/feature-flags", () => {
	it("returns requested rows, with absent flags disabled", async () => {
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		asPersona("aria");

		const { GET } = await import("@/app/api/feature-flags/route");
		const { status, data } = await readJson<{ flags: TimedFlagRow[]; serverNow: string }>(
			await GET(
				makeRequest("/api/feature-flags?names=maincomm-ranking-period,subcomm-ranking-period"),
			),
		);

		expect(status).toBe(200);
		expect(Number.isFinite(Date.parse(data.serverNow))).toBe(true);
		expect(data.flags).toHaveLength(2);
		const byName = new Map(data.flags.map((f) => [f.name, f]));
		expect(byName.get("maincomm-ranking-period")?.enabled).toBe(false);
		expect(byName.get("subcomm-ranking-period")?.enabled).toBe(true);
		expect(byName.get("subcomm-ranking-period")?.expires_at).not.toBeNull();
	});

	it("400s without a names parameter", async () => {
		asPersona("aria");
		const { GET } = await import("@/app/api/feature-flags/route");
		const { status } = await readJson(await GET(makeRequest("/api/feature-flags")));
		expect(status).toBe(400);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/feature-flags/route");
		const { status } = await readJson(
			await GET(makeRequest("/api/feature-flags?names=subcomm-ranking-period")),
		);
		expect(status).toBe(401);
	});
});

// GET /api/user/rankable-positions/[email] — the open-period positions only.
describe("GET /api/user/rankable-positions", () => {
	async function fetchPositions() {
		const { GET } = await import("@/app/api/user/rankable-positions/[email]/route");
		return readJson<{ positions: RankablePosition[]; periods: RankingPeriodState[] }>(await GET());
	}

	it("returns nothing while every period is closed", async () => {
		asPersona("aria");
		const { status, data } = await fetchPositions();

		expect(status).toBe(200);
		expect(data.positions).toEqual([]);
		expect(data.periods).toHaveLength(2);
		expect(data.periods.every((p) => !p.active)).toBe(true);
	});

	it("returns only subcomm positions while the subcomm period is open", async () => {
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		asPersona("aria");
		const { status, data } = await fetchPositions();

		expect(status).toBe(200);
		expect(data.positions.length).toBeGreaterThan(0);
		expect(new Set(data.positions.map((p) => p.position_type))).toEqual(new Set(["subcomm"]));
		expect(data.periods.find((p) => p.key === "subcomm")?.active).toBe(true);
	});

	it("returns maincomm and blockcomm positions while the maincomm period is open", async () => {
		await setFeatureFlag("maincomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		asPersona("aria");
		const { status, data } = await fetchPositions();

		expect(status).toBe(200);
		const types = new Set(data.positions.map((p) => p.position_type));
		expect(types).toEqual(new Set(["maincomm", "blockcomm"]));
	});
});

// GET /api/user/preferences — the caller's saved list, locked rows included.
describe("GET /api/user/preferences", () => {
	it("returns the saved list in rank order with position details", async () => {
		await setFeatureFlag("subcomm-ranking-period", { enabled: true, expiresInMs: HOUR_MS });
		asPersona("aria");

		const { POST } = await import("@/app/api/user/rankings/route");
		const { pgPool } = await import("../setup");
		const ids = await pgPool.query(
			`SELECT cp.id, c.name AS cca_name
			   FROM cca_positions cp
			   JOIN ccas c ON c.id = cp.cca_id
			  WHERE cp.name = 'Subcomm' AND c.name IN ('SHWEB', 'SECC')
			  ORDER BY c.name`,
		);
		const [secc, shweb] = ids.rows;
		await POST(
			jsonRequest("/api/user/rankings", "POST", {
				rankings: [
					{ position_id: shweb.id, ranking: 1 },
					{ position_id: secc.id, ranking: 2 },
				],
			}),
		);

		const { GET } = await import("@/app/api/user/preferences/route");
		const { status, data } = await readJson<{ preferences: SavedPreference[] }>(await GET());

		expect(status).toBe(200);
		expect(data.preferences).toEqual([
			{
				position_id: shweb.id,
				rank: 1,
				name: "Subcomm",
				cca_name: "SHWEB",
				position_type: "subcomm",
			},
			{
				position_id: secc.id,
				rank: 2,
				name: "Subcomm",
				cca_name: "SECC",
				position_type: "subcomm",
			},
		]);
	});

	it("401s for anonymous", async () => {
		asPersona("anonymous");
		const { GET } = await import("@/app/api/user/preferences/route");
		const { status } = await readJson(await GET());
		expect(status).toBe(401);
	});
});

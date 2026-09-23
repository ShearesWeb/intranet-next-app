import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	getSlots: vi.fn(),
	withUserCcaContext: vi.fn(),
	getChairCcaIds: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/facilities/facility-slots", () => ({
	getSlots: mocks.getSlots,
	withUserCcaContext: mocks.withUserCcaContext,
}));
vi.mock("@/lib/facilities/facility-access", () => ({ getChairCcaIds: mocks.getChairCcaIds }));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function slot(type: string, date: string) {
	return { facility_id: 1, venue: "V", sub_venue: "S", type, date, hour: 19, claims: [] };
}

function get(start: string, end: string) {
	const q = new URLSearchParams({ start, end });
	return new NextRequest(`http://localhost/api/facilities/slots?${q}`);
}

describe("GET /api/facilities/slots — Sheares-only catalog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.getChairCcaIds.mockReturnValue([]);
		// Identity, so assertions read the filtered list the route hands over.
		mocks.withUserCcaContext.mockImplementation((slots: unknown[]) => slots);
	});

	it("returns only Sheares slots", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 1, is_jcrc: false });
		mocks.getSlots.mockResolvedValue([
			slot("reboks", "2026-09-01"),
			slot("nus", "2026-09-01"),
			slot("external", "2026-09-01"),
			slot("sheares", "2026-09-01"),
		]);

		const { GET } = await import("./route");
		const body = await (await GET(get("2026-09-01", "2026-09-30"))).json();

		expect(body.data).toHaveLength(1);
		expect(body.data[0].type).toBe("sheares");
	});

	it("applies the same restriction to JCRC", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 1, is_jcrc: true });
		mocks.getSlots.mockResolvedValue([slot("reboks", "2026-09-01"), slot("sheares", "2026-09-01")]);

		const { GET } = await import("./route");
		const body = await (await GET(get("2026-09-01", "2026-09-30"))).json();

		expect(body.data).toHaveLength(1);
		expect(body.data[0].type).toBe("sheares");
	});

	it("400s without a window", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 1, is_jcrc: false });
		const { GET } = await import("./route");
		const res = await GET(new NextRequest("http://localhost/api/facilities/slots"));
		expect(res.status).toBe(400);
	});
});

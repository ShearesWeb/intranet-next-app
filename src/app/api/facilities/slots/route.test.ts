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

/** First of the month after next, always past the horizon whatever day it is. */
function beyondHorizon(): string {
	const next = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1);
	return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayKey(): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
}

function slot(type: string, date: string) {
	return { facility_id: 1, venue: "V", sub_venue: "S", type, date, hour: 19, claims: [] };
}

function get(start: string, end: string, type?: string) {
	const q = new URLSearchParams({ start, end, ...(type ? { type } : {}) });
	return new NextRequest(`http://localhost/api/facilities/slots?${q}`);
}

describe("GET /api/facilities/slots — REBOKS horizon", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.getChairCcaIds.mockReturnValue([]);
		// Identity, so assertions read the trimmed list the route hands over.
		mocks.withUserCcaContext.mockImplementation((slots: unknown[]) => slots);
	});

	it("trims a chair's reboks slots past the current month, keeping hall venues", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 1, is_jcrc: false });
		mocks.getSlots.mockResolvedValue([
			slot("reboks", todayKey()),
			slot("reboks", beyondHorizon()),
			slot("sheares", beyondHorizon()),
		]);

		const { GET } = await import("./route");
		const body = await (await GET(get(todayKey(), beyondHorizon()))).json();

		expect(body.data).toHaveLength(2);
		expect(body.data.map((s: { type: string }) => s.type)).toEqual(["reboks", "sheares"]);
		expect(body.data.some((s: { date: string }) => s.date === beyondHorizon())).toBe(true);
	});

	it("leaves JCRC the full horizon", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 1, is_jcrc: true });
		mocks.getSlots.mockResolvedValue([slot("reboks", todayKey()), slot("reboks", beyondHorizon())]);

		const { GET } = await import("./route");
		const body = await (await GET(get(todayKey(), beyondHorizon()))).json();

		expect(body.data).toHaveLength(2);
	});

	it("applies the type filter on top of the trim, not instead of it", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 1, is_jcrc: false });
		mocks.getSlots.mockResolvedValue([slot("reboks", todayKey()), slot("reboks", beyondHorizon())]);

		const { GET } = await import("./route");
		const body = await (await GET(get(todayKey(), beyondHorizon(), "reboks"))).json();

		expect(body.data).toHaveLength(1);
		expect(body.data[0].date).toBe(todayKey());
	});

	it("400s without a window", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 1, is_jcrc: false });
		const { GET } = await import("./route");
		const res = await GET(new NextRequest("http://localhost/api/facilities/slots"));
		expect(res.status).toBe(400);
	});
});

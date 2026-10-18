import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	requireJcrcAccess: vi.fn(),
	listSchedules: vi.fn(),
	getSchedule: vi.fn(),
	createSchedule: vi.fn(),
	updateSchedule: vi.fn(),
	deleteSchedule: vi.fn(),
	syncFacilityScheduleGrid: vi.fn(),
	getFacilityType: vi.fn(),
	listFacilities: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
	requireAuth: mocks.requireAuth,
	requireJcrcAccess: mocks.requireJcrcAccess,
}));
vi.mock("@/lib/facilities/facility-schedules", () => ({
	listSchedules: mocks.listSchedules,
	getSchedule: mocks.getSchedule,
	createSchedule: mocks.createSchedule,
	updateSchedule: mocks.updateSchedule,
	deleteSchedule: mocks.deleteSchedule,
	syncFacilityScheduleGrid: mocks.syncFacilityScheduleGrid,
}));
vi.mock("@/lib/facilities/facility-catalog", () => ({
	getFacilityType: mocks.getFacilityType,
	listFacilities: mocks.listFacilities,
}));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function req(method: string, body: unknown) {
	return new NextRequest("http://localhost/api/facilities/schedules", {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("schedules route writes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCoreServiceDisabledApiResponse.mockReturnValue(null);
		mocks.getFacilityType.mockResolvedValue("sheares");
		mocks.listFacilities.mockResolvedValue([{ id: 2, type: "sheares" }]);
		mocks.getSchedule.mockResolvedValue({ id: 7, facility_id: 2 });
	});

	it("GET returns only schedules for Sheares facilities", async () => {
		mocks.requireAuth.mockResolvedValue({ id: 1 });
		mocks.listSchedules.mockResolvedValue([
			{ id: 1, facility_id: 2 },
			{ id: 2, facility_id: 9 },
		]);
		const { GET } = await import("./route");
		const res = await GET(new NextRequest("http://localhost/api/facilities/schedules"));
		expect((await res.json()).data).toEqual([{ id: 1, facility_id: 2 }]);
	});

	it("POST returns 403 for non-JCRC callers", async () => {
		mocks.requireJcrcAccess.mockRejectedValue(new ApiError(403, "Unauthorized"));
		const { POST } = await import("./route");
		const res = await POST(req("POST", { facility_id: 2, day_of_week: 1, hour: 19 }));
		expect(res.status).toBe(403);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("POST rejects day_of_week out of range", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { POST } = await import("./route");
		const res = await POST(req("POST", { facility_id: 2, day_of_week: 9, hour: 19 }));
		expect(res.status).toBe(400);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	// `priority` and `reboks_activity` did not survive the facilities rebuild,
	// so a body carrying them is accepted and the extras are simply not forwarded.
	it("POST forwards only the surviving columns and returns 201", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		mocks.createSchedule.mockResolvedValue({ id: 1, facility_id: 2, day_of_week: 1, hour: 19 });
		const { POST } = await import("./route");
		const res = await POST(
			req("POST", {
				facility_id: 2,
				day_of_week: 1,
				hour: 19,
				priority: 1,
				reboks_activity: "Tennis",
			}),
		);
		expect(res.status).toBe(201);
		expect(mocks.createSchedule).toHaveBeenCalledWith({
			facilityId: 2,
			dayOfWeek: 1,
			hour: 19,
			startDate: null,
			endDate: null,
		});
	});

	it("POST rejects a malformed start_date", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { POST } = await import("./route");
		const res = await POST(
			req("POST", { facility_id: 2, day_of_week: 1, hour: 19, start_date: "01/06/2026" }),
		);
		expect(res.status).toBe(400);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("POST rejects start_date after end_date", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { POST } = await import("./route");
		const res = await POST(
			req("POST", {
				facility_id: 2,
				day_of_week: 1,
				hour: 19,
				start_date: "2026-09-01",
				end_date: "2026-08-01",
			}),
		);
		expect(res.status).toBe(400);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("POST forwards date bounds to createSchedule", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		mocks.createSchedule.mockResolvedValue({ id: 1 });
		const { POST } = await import("./route");
		const res = await POST(
			req("POST", {
				facility_id: 2,
				day_of_week: 1,
				hour: 19,
				start_date: "2026-08-01",
				end_date: "2026-09-30",
			}),
		);
		expect(res.status).toBe(201);
		expect(mocks.createSchedule).toHaveBeenCalledWith(
			expect.objectContaining({ startDate: "2026-08-01", endDate: "2026-09-30" }),
		);
	});

	it("POST rejects a non-Sheares facility", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		mocks.getFacilityType.mockResolvedValue("nus");
		const { POST } = await import("./route");
		const res = await POST(req("POST", { facility_id: 2, day_of_week: 1, hour: 19 }));
		expect(res.status).toBe(403);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("PUT replaces a facility schedule grid", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		mocks.syncFacilityScheduleGrid.mockResolvedValue([
			{ id: 8, facility_id: 2, day_of_week: 1, hour: 18 },
		]);
		const { PUT } = await import("./route");
		const res = await PUT(req("PUT", { facility_id: 2, days: [3, 1, 1], hours: [19, 18, 18] }));

		expect(res.status).toBe(200);
		expect(mocks.syncFacilityScheduleGrid).toHaveBeenCalledWith(2, [1, 3], [18, 19]);
	});

	it("PUT rejects invalid days", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { PUT } = await import("./route");
		const res = await PUT(req("PUT", { facility_id: 2, days: [7], hours: [18] }));

		expect(res.status).toBe(400);
		expect(mocks.syncFacilityScheduleGrid).not.toHaveBeenCalled();
	});

	it("PATCH returns 400 without an id", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { PATCH } = await import("./route");
		const res = await PATCH(req("PATCH", { end_date: "2026-09-30" }));
		expect(res.status).toBe(400);
		expect(mocks.updateSchedule).not.toHaveBeenCalled();
	});

	// End-dating is how availability is withdrawn without touching a claim.
	it("PATCH updates the date window and returns 200", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		mocks.updateSchedule.mockResolvedValue({
			id: 7,
			facility_id: 2,
			day_of_week: 1,
			hour: 19,
			start_date: null,
			end_date: "2026-09-30",
		});
		const { PATCH } = await import("./route");
		const res = await PATCH(req("PATCH", { id: 7, end_date: "2026-09-30" }));
		expect(res.status).toBe(200);
		expect(mocks.updateSchedule).toHaveBeenCalledWith(7, { end_date: "2026-09-30" });
	});

	it("PATCH rejects a malformed end_date", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { PATCH } = await import("./route");
		const res = await PATCH(req("PATCH", { id: 7, end_date: "30-09-2026" }));
		expect(res.status).toBe(400);
		expect(mocks.updateSchedule).not.toHaveBeenCalled();
	});
});

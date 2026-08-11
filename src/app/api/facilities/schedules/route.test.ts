import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
	requireAuth: vi.fn(),
	requireJcrcAccess: vi.fn(),
	listSchedules: vi.fn(),
	createSchedule: vi.fn(),
	updateSchedule: vi.fn(),
	deleteSchedule: vi.fn(),
	getCoreServiceDisabledApiResponse: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
	requireAuth: mocks.requireAuth,
	requireJcrcAccess: mocks.requireJcrcAccess,
}));
vi.mock("@/lib/facilities/facility-schedules", () => ({
	listSchedules: mocks.listSchedules,
	createSchedule: mocks.createSchedule,
	updateSchedule: mocks.updateSchedule,
	deleteSchedule: mocks.deleteSchedule,
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

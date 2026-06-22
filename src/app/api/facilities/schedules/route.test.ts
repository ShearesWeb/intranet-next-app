import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/lib/facilities/booking-schedules", () => ({
	listSchedules: mocks.listSchedules,
	createSchedule: mocks.createSchedule,
	updateSchedule: mocks.updateSchedule,
	deleteSchedule: mocks.deleteSchedule,
}));
vi.mock("@/lib/feature-flags", () => ({
	getCoreServiceDisabledApiResponse: mocks.getCoreServiceDisabledApiResponse,
}));

function req(method: string, body: unknown) {
	return new Request("http://localhost/api/facilities/schedules", {
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

	it("POST forwards priority + reboks_activity and returns 201", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const row = {
			id: 1,
			facility_id: 2,
			day_of_week: 1,
			hour: 19,
			priority: 1,
			reboks_activity: "Tennis",
		};
		mocks.createSchedule.mockResolvedValue(row);
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
			priority: 1,
			reboksActivity: "Tennis",
		});
	});

	it("PATCH returns 400 without an id", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const { PATCH } = await import("./route");
		const res = await PATCH(req("PATCH", { priority: 2 }));
		expect(res.status).toBe(400);
		expect(mocks.updateSchedule).not.toHaveBeenCalled();
	});

	it("PATCH updates and returns 200", async () => {
		mocks.requireJcrcAccess.mockResolvedValue({ is_jcrc: true });
		const row = {
			id: 7,
			facility_id: 2,
			day_of_week: 1,
			hour: 19,
			priority: 2,
			reboks_activity: "Squash",
		};
		mocks.updateSchedule.mockResolvedValue(row);
		const { PATCH } = await import("./route");
		const res = await PATCH(req("PATCH", { id: 7, priority: 2, reboks_activity: "Squash" }));
		expect(res.status).toBe(200);
		expect(mocks.updateSchedule).toHaveBeenCalledWith(7, { priority: 2, reboks_activity: "Squash" });
	});
});

import { requireAuth, requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	listSchedules,
	createSchedule,
	updateSchedule,
	deleteSchedule,
} from "@/lib/facilities/booking-schedules";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireAuth();
		const facilityIdParam = req.nextUrl.searchParams.get("facility_id");
		const facilityId = facilityIdParam ? Number(facilityIdParam) : undefined;
		const schedules = await listSchedules(facilityId);
		return apiOk(schedules);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { facility_id, day_of_week, hour, priority, reboks_activity } = await req.json();

		if (facility_id == null || day_of_week == null || hour == null) {
			return apiError("facility_id, day_of_week and hour are required", 400);
		}
		if (day_of_week < 0 || day_of_week > 6) return apiError("day_of_week must be 0–6", 400);
		if (hour < 0 || hour > 23) return apiError("hour must be 0–23", 400);
		if (priority != null && priority < 0) return apiError("priority must be >= 0", 400);

		const schedule = await createSchedule({
			facilityId: facility_id,
			dayOfWeek: day_of_week,
			hour,
			priority: priority ?? undefined,
			reboksActivity: reboks_activity ?? null,
		});
		return apiOk(schedule, 201);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function PATCH(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { id, priority, reboks_activity } = await req.json();

		if (id == null) return apiError("id is required", 400);
		if (priority != null && priority < 0) return apiError("priority must be >= 0", 400);

		const patch: { priority?: number; reboks_activity?: string | null } = {};
		if (priority !== undefined) patch.priority = priority;
		if (reboks_activity !== undefined) patch.reboks_activity = reboks_activity;

		const schedule = await updateSchedule(id, patch);
		return apiOk(schedule);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function DELETE(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const idParam = req.nextUrl.searchParams.get("id");
		if (!idParam) return apiError("id is required", 400);
		await deleteSchedule(Number(idParam));
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

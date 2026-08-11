import { requireAuth, requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	listSchedules,
	createSchedule,
	updateSchedule,
	deleteSchedule,
} from "@/lib/facilities/facility-schedules";
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
		// `priority` and `reboks_activity` are accepted-and-ignored: both columns went
		// away with the facilities rebuild.
		const { facility_id, day_of_week, hour, start_date, end_date } = await req.json();

		if (facility_id == null || day_of_week == null || hour == null) {
			return apiError("facility_id, day_of_week and hour are required", 400);
		}
		if (day_of_week < 0 || day_of_week > 6) return apiError("day_of_week must be 0–6", 400);
		if (hour < 0 || hour > 23) return apiError("hour must be 0–23", 400);

		const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
		if (start_date != null && !DATE_RE.test(start_date)) {
			return apiError("start_date must be YYYY-MM-DD", 400);
		}
		if (end_date != null && !DATE_RE.test(end_date)) {
			return apiError("end_date must be YYYY-MM-DD", 400);
		}
		if (start_date && end_date && start_date > end_date) {
			return apiError("start_date must be on or before end_date", 400);
		}

		const schedule = await createSchedule({
			facilityId: facility_id,
			dayOfWeek: day_of_week,
			hour,
			startDate: start_date ?? null,
			endDate: end_date ?? null,
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
		const { id, start_date, end_date } = await req.json();

		if (id == null) return apiError("id is required", 400);

		const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
		if (start_date != null && !DATE_RE.test(start_date)) {
			return apiError("start_date must be YYYY-MM-DD", 400);
		}
		if (end_date != null && !DATE_RE.test(end_date)) {
			return apiError("end_date must be YYYY-MM-DD", 400);
		}

		// End-dating is how a slot stops being offered; it never touches a claim.
		const patch: { start_date?: string | null; end_date?: string | null } = {};
		if (start_date !== undefined) patch.start_date = start_date;
		if (end_date !== undefined) patch.end_date = end_date;

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

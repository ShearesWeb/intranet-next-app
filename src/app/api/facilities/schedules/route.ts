import { requireAuth, requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	listSchedules,
	getSchedule,
	createSchedule,
	updateSchedule,
	deleteSchedule,
	setFacilityVisibility,
	syncFacilityScheduleCells,
} from "@/lib/facilities/facility-schedules";
import { getFacilityType, listFacilities } from "@/lib/facilities/facility-catalog";
import { deleteClaims, getClaimOwners } from "@/lib/facilities/facility-claims";
import { ApiError } from "@/lib/api/errors";
import { type ScheduleCell } from "@/lib/facilities/weekly-availability";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function isShearesSchedule(id: number): Promise<boolean> {
	const schedule = await getSchedule(id);
	if (!schedule) return false;
	return (await getFacilityType(schedule.facility_id)) === "sheares";
}

export async function GET(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireAuth();
		const facilityIdParam = req.nextUrl.searchParams.get("facility_id");
		const facilityId = facilityIdParam ? Number(facilityIdParam) : undefined;
		const schedules = await listSchedules(facilityId);
		const shearesFacilityIds = new Set(
			(await listFacilities({ type: "sheares" })).map((facility) => facility.id),
		);
		return apiOk(schedules.filter((schedule) => shearesFacilityIds.has(schedule.facility_id)));
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
		if ((await getFacilityType(facility_id)) !== "sheares") {
			return apiError("Only Sheares facility schedules can be managed", 403);
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

/**
 * Replace one facility's recurring availability with a painted set of cells.
 *
 * `cancel_claim_ids` names the bookings JCRC agreed to cancel by closing their
 * hours. They are named rather than derived, so a booking made after the editor
 * loaded is never cancelled unseen.
 */
export async function PUT(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { facility_id, cells, cancel_claim_ids } = await req.json();

		if (facility_id == null || !Array.isArray(cells)) {
			return apiError("facility_id and cells are required", 400);
		}
		const parsed = cells as ScheduleCell[];
		if (parsed.some((cell) => !Number.isInteger(cell?.day) || cell.day < 0 || cell.day > 6)) {
			return apiError("cells must use weekday numbers from 0–6", 400);
		}
		if (parsed.some((cell) => !Number.isInteger(cell?.hour) || cell.hour < 0 || cell.hour > 23)) {
			return apiError("cells must use hours from 0–23", 400);
		}
		if ((await getFacilityType(facility_id)) !== "sheares") {
			return apiError("Only Sheares facility schedules can be managed", 403);
		}

		const cancelIds: number[] = Array.isArray(cancel_claim_ids)
			? [...new Set<number>(cancel_claim_ids)]
			: [];
		const owners = await getClaimOwners(cancelIds);
		if (
			owners.length !== cancelIds.length ||
			owners.some((claim) => claim.facility_id !== facility_id)
		) {
			return apiError("cancel_claim_ids must name claims on this facility", 400);
		}

		const schedules = await syncFacilityScheduleCells(facility_id, parsed);

		// After the save: a failed save must not have already cost anyone a booking.
		try {
			await deleteClaims(cancelIds);
		} catch (error) {
			console.error("Error cancelling claims in closed hours:", error);
			throw new ApiError(500, "Hours saved, but some bookings could not be cancelled");
		}

		return apiOk(schedules);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function PATCH(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { id, start_date, end_date, facility_id, visible } = await req.json();

		// Whole-venue toggle: show or hide it on Book, keeping its hours.
		if (facility_id != null && typeof visible === "boolean") {
			if ((await getFacilityType(facility_id)) !== "sheares") {
				return apiError("Only Sheares facility schedules can be managed", 403);
			}
			return apiOk(await setFacilityVisibility(facility_id, visible));
		}

		if (id == null) return apiError("id is required", 400);

		const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
		if (start_date != null && !DATE_RE.test(start_date)) {
			return apiError("start_date must be YYYY-MM-DD", 400);
		}
		if (end_date != null && !DATE_RE.test(end_date)) {
			return apiError("end_date must be YYYY-MM-DD", 400);
		}
		if (!(await isShearesSchedule(id))) {
			return apiError("Only Sheares facility schedules can be managed", 403);
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
		const id = Number(idParam);
		if (!(await isShearesSchedule(id))) {
			return apiError("Only Sheares facility schedules can be managed", 403);
		}
		await deleteSchedule(id);
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getSlots } from "@/lib/facilities/facility-slots";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The facilities calendar.
 *
 * Slots are computed by `facility_slots(from, to)`, so there is no POST here:
 * publishing availability means writing a `facility_schedules` row, which
 * `/api/facilities/schedules` owns, and booking one means writing a
 * `facility_claims` row, which `/api/facilities/claims` owns.
 */
export async function GET(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireAuth();
		const { searchParams } = req.nextUrl;
		const start = searchParams.get("start");
		const end = searchParams.get("end");

		if (!start || !end) return apiError("start and end are required", 400);

		return apiOk((await getSlots(start, end)).filter((slot) => slot.type === "sheares"));
	} catch (e) {
		return handleApiError(e);
	}
}

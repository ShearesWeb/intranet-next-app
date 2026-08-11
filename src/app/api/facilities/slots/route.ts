import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getSlots, withUserCcaContext } from "@/lib/facilities/facility-slots";
import { getChairCcaIds } from "@/lib/facilities/facility-access";
import { FacilityType } from "@/types/facilities";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const VALID_TYPES: FacilityType[] = ["sheares", "reboks", "nus", "external"];

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
		const user = await requireAuth();
		const { searchParams } = req.nextUrl;
		const start = searchParams.get("start");
		const end = searchParams.get("end");
		const typeParam = searchParams.get("type");

		if (!start || !end) return apiError("start and end are required", 400);

		const slots = await getSlots(start, end);

		const type = VALID_TYPES.includes(typeParam as FacilityType)
			? (typeParam as FacilityType)
			: undefined;
		const filtered = type ? slots.filter((slot) => slot.type === type) : slots;

		return apiOk(withUserCcaContext(filtered, getChairCcaIds(user)));
	} catch (e) {
		return handleApiError(e);
	}
}

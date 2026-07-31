import { requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { deleteBookingSeries } from "@/lib/facilities/facility-bookings";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Cancel all recurring — drop the schedule recipe + future occurrences. */
export async function DELETE(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { facility_id, day_of_week, hour, from_date } = await req.json();

		if (facility_id == null || day_of_week == null || hour == null) {
			return apiError("facility_id, day_of_week and hour are required", 400);
		}

		const result = await deleteBookingSeries({
			facilityId: facility_id,
			dayOfWeek: day_of_week,
			hour,
			fromDate: from_date ?? new Date().toISOString().slice(0, 10),
		});
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

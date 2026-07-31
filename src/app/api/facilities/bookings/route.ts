import { requireAuth, requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	listBookings,
	createBooking,
	createRecurringBookings,
} from "@/lib/facilities/facility-bookings";
import { getChairCcaIds } from "@/lib/facilities/facility-access";
import { FacilityType } from "@/types/facilities";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const VALID_TYPES: FacilityType[] = ["sheares", "reboks", "nus", "external"];

export async function GET(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		const { searchParams } = req.nextUrl;
		const start = searchParams.get("start");
		const end = searchParams.get("end");
		const typeParam = searchParams.get("type");

		if (!start || !end) return apiOk([]);

		const type = VALID_TYPES.includes(typeParam as FacilityType)
			? (typeParam as FacilityType)
			: undefined;

		const bookings = await listBookings({
			startDate: start,
			endDate: end,
			type,
			userCcaIds: getChairCcaIds(user),
		});
		return apiOk(bookings);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const body = await req.json();
		const { facility_id, hour, recurring } = body;

		if (facility_id == null || hour == null) {
			return apiError("facility_id and hour are required", 400);
		}
		if (hour < 0 || hour > 23) return apiError("hour must be 0–23", 400);

		if (recurring) {
			const { day_of_week, start_date, end_date } = body;
			if (day_of_week == null || !start_date || !end_date) {
				return apiError("Recurring bookings need day_of_week, start_date and end_date", 400);
			}
			const result = await createRecurringBookings({
				facilityId: facility_id,
				dayOfWeek: day_of_week,
				hour,
				startDate: start_date,
				endDate: end_date,
			});
			return apiOk(result, 201);
		}

		const { booked_date } = body;
		if (!booked_date) return apiError("booked_date is required", 400);
		const booking = await createBooking(facility_id, booked_date, hour);
		return apiOk(booking, 201);
	} catch (e) {
		return handleApiError(e);
	}
}

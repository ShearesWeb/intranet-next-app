import { requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	createFacilitySlots,
	getManagedSlots,
	expandRecurringDates,
} from "@/lib/facilities/facility-management";
import { BookingType } from "@/types/facilities";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { searchParams } = req.nextUrl;
		const startDate = searchParams.get("start");
		const endDate = searchParams.get("end");

		if (!startDate || !endDate) {
			return apiOk([]);
		}

		const slots = await getManagedSlots(startDate, endDate);
		return apiOk(slots);
	} catch (e) {
		return handleApiError(e);
	}
}

const VALID_TYPES: BookingType[] = ["sheares", "reboks", "nus", "external"];

export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const body = await req.json();

		const {
			venue,
			sub_venue,
			activity,
			time_from,
			time_to,
			type,
			remark,
			date,
			recurring,
			recurring_start,
			recurring_end,
			days_of_week,
		} = body;

		if (!venue || !sub_venue || !activity || !time_from || !time_to || !type) {
			return apiError("Missing required fields", 400);
		}

		if (!VALID_TYPES.includes(type)) {
			return apiError("Invalid booking type", 400);
		}

		if (time_from >= time_to) {
			return apiError("Start time must be before end time", 400);
		}

		let dates: string[];

		if (recurring) {
			if (!recurring_start || !recurring_end || !days_of_week?.length) {
				return apiError("Recurring slots need start date, end date, and days of week", 400);
			}
			dates = expandRecurringDates(recurring_start, recurring_end, days_of_week);
			if (dates.length === 0) {
				return apiError("No dates match the selected days of week in that range", 400);
			}
			if (dates.length > 100) {
				return apiError("Too many slots (max 100). Shorten the date range.", 400);
			}
		} else {
			if (!date) {
				return apiError("Date is required for single slots", 400);
			}
			dates = [date];
		}

		const slots = await createFacilitySlots({
			venue,
			sub_venue,
			activity,
			time_from,
			time_to,
			type,
			remark: remark || null,
			dates,
		});

		return apiOk(slots, 201);
	} catch (e) {
		return handleApiError(e);
	}
}

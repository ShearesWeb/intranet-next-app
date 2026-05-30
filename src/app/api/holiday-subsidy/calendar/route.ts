import { apiOk, handleApiError } from "@/lib/api/response";
import { requireAuth } from "@/lib/api/auth";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { ApiError } from "@/lib/api/errors";
import { getCalendarDeclarations } from "@/lib/holiday-subsidy/calendar-service";
import { getChairCcaIds } from "@/lib/facilities/facility-access";

export async function GET(request: Request) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();

		const { searchParams } = new URL(request.url);
		const start = searchParams.get("start");
		const end = searchParams.get("end");

		if (!start || !end) {
			throw new ApiError(400, "start and end query params required");
		}

		const ccaIdParam = searchParams.get("ccaId");
		let ccaIds: number[] | undefined;

		if (ccaIdParam) {
			ccaIds = [parseInt(ccaIdParam, 10)];
			if (isNaN(ccaIds[0])) throw new ApiError(400, "Invalid ccaId");
		} else if (user.is_jcrc || user.is_admin) {
			ccaIds = undefined;
		} else {
			ccaIds = getChairCcaIds(user);
			if (!ccaIds.length) {
				return apiOk({ declarations: [] });
			}
		}

		const declarations = await getCalendarDeclarations({
			startDate: start,
			endDate: end,
			ccaIds,
		});

		return apiOk({ declarations });
	} catch (e) {
		return handleApiError(e);
	}
}

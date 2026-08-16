// src/app/api/user/rankable-positions/[email]/route.ts
// API route to get the positions a user can rank during the open periods.
import { fetchUserId } from "@/lib/auth/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getRankablePositions } from "@/lib/allocation/preference-service";
import { getRankingPeriodStates } from "@/lib/timed-flags/service";
import { openPositionTypes } from "@/lib/timed-flags/ranking-periods";

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const userId = await fetchUserId();
		if (!userId) return apiError("Unauthorized", 401);

		const periods = await getRankingPeriodStates();
		const positions = await getRankablePositions(userId, openPositionTypes(periods));
		return apiOk({ positions, periods });
	} catch (e) {
		return handleApiError(e);
	}
}

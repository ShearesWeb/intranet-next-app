// src/app/api/user/rankings/route.ts
// API route to save the requesting user's CCA preference ranking.
//
// The open ranking periods are resolved server-side on every save, so a
// submission after a window closes is rejected here regardless of what the
// client showed. `saveRankings` scopes the write to the open periods and
// carries locked rows over untouched.
import { fetchUserId } from "@/lib/auth/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { saveRankings } from "@/lib/allocation/preference-service";
import { getRankingPeriodStates } from "@/lib/timed-flags/service";
import { openPositionTypes } from "@/lib/timed-flags/ranking-periods";

export async function POST(request: Request) {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const userId = await fetchUserId();
		if (!userId) return apiError("Unauthorized", 401);

		const { rankings } = await request.json();
		if (!Array.isArray(rankings)) return apiError("Missing or invalid rankings array", 400);

		const periods = await getRankingPeriodStates();
		await saveRankings(userId, rankings, openPositionTypes(periods));
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

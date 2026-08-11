// src/app/api/user/rankings/route.ts
// API route to save the requesting user's CCA preference ranking.
//
// Delegates to `saveRankings` in the ranking service, which handles the
// staged-rank pattern for UNIQUE constraint safety and prunes stale rows.
import { fetchUserId } from "@/lib/auth/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { saveRankings } from "@/lib/allocation/preference-service";

export async function POST(request: Request) {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const userId = await fetchUserId();
		if (!userId) return apiError("Unauthorized", 401);

		const { rankings } = await request.json();
		if (!Array.isArray(rankings)) return apiError("Missing or invalid rankings array", 400);

		await saveRankings(userId, rankings);
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

// src/app/api/user/rankable-positions/[email]/route.ts
// API route to get the positions a user can rank.
import { fetchUserId } from "@/lib/auth/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getRankablePositions } from "@/features/ranking/services/user-ranking-service";

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const userId = await fetchUserId();
		if (!userId) return apiError("Unauthorized", 401);

		const positions = await getRankablePositions(userId);
		return apiOk({ positions });
	} catch (e) {
		return handleApiError(e);
	}
}

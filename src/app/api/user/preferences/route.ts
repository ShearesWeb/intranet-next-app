// GET /api/user/preferences — the caller's full saved preference list,
// including rows from periods that have since closed (shown locked in the UI).
import { fetchUserId } from "@/lib/auth/fetch-user-info";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getSavedPreferences } from "@/lib/allocation/preference-service";

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const userId = await fetchUserId();
		if (!userId) return apiError("Unauthorized", 401);

		const preferences = await getSavedPreferences(userId);
		return apiOk({ preferences });
	} catch (e) {
		return handleApiError(e);
	}
}

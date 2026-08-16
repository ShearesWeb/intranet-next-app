// GET /api/feature-flags?names=a,b — timed flag rows plus the server clock.
// `serverNow` lets clients correct for local clock skew before evaluating
// windows; the rows come back raw so clients re-evaluate as time passes.
import { fetchUserId } from "@/lib/auth/fetch-user-info";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getTimedFlagRows } from "@/lib/timed-flags/service";

export async function GET(request: Request) {
	try {
		const userId = await fetchUserId();
		if (!userId) return apiError("Unauthorized", 401);

		const namesParam = new URL(request.url).searchParams.get("names") ?? "";
		const names = namesParam
			.split(",")
			.map((name) => name.trim())
			.filter(Boolean);
		if (names.length === 0) return apiError("Missing names query parameter", 400);

		const flags = await getTimedFlagRows(names);
		return apiOk({ flags, serverNow: new Date().toISOString() }, 200, {
			"Cache-Control": "no-store, private",
		});
	} catch (e) {
		return handleApiError(e);
	}
}

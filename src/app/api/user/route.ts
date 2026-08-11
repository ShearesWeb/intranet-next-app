import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { isCultureSportsChair } from "@/types/user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_HEADERS = { "Cache-Control": "no-store, private" };

export async function GET() {
	try {
		const user = await requireAuth();

		// `is_chair` and `is_jcrc` come off `my_profile`; kind-specific predicates
		// are app policy derived from `appointments`. Project the one the UI needs
		// here so each client does not re-derive it.
		return apiOk(
			{ ...user, is_culture_sports_chair: isCultureSportsChair(user) },
			200,
			CACHE_HEADERS,
		);
	} catch (e) {
		return handleApiError(e);
	}
}

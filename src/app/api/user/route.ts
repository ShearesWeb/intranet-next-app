import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_HEADERS = { "Cache-Control": "no-store, private" };

export async function GET() {
	try {
		const user = await requireAuth();

		return apiOk(user, 200, CACHE_HEADERS);
	} catch (e) {
		return handleApiError(e);
	}
}

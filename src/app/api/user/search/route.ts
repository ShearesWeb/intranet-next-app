// src/app/api/user/search/route.ts
// API route to search for users by name, email, or room
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { checkCcaAuthorization } from "@/lib/cca/cca-chair-access";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";

export async function GET(request: Request) {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		const supabase = await createClient();

		// `checkCcaAuthorization` is async (see `cca-chair-access.ts`): with no `cca`
		// argument it short-circuits on the JWT fast path (no DB round-trip).
		const authResult = await checkCcaAuthorization({ requestingUser: user });

		if (!authResult.ok || !authResult.data.hasChairAccess) {
			return apiError("Forbidden: Only CCA leads/vices can search users", 403);
		}

		const { searchParams } = new URL(request.url);
		const query = searchParams.get("query")?.trim();

		if (!query || query.length < 2) {
			return apiError("Query must be at least 2 characters.", 400);
		}

		// `authenticated_user_directory` exposes `id, email, name, room, telegram_handle,
		// profile_photo_path` to authenticated callers (see
		// intranet-wiki/wiki/entity/view/public.authenticated_user_directory.md).
		const { data, error } = await supabase
			.from("authenticated_user_directory")
			.select("id, name, email, room")
			.or(`name.ilike.%${query}%,email.ilike.%${query}%,room.ilike.%${query}%`)
			.order("name")
			.limit(10);

		if (error) {
			console.error("User search error:", error);
			return apiError("Database query failed.", 500);
		}

		const users = (data ?? []).map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			room: u.room,
		}));

		return apiOk(users);
	} catch (e) {
		return handleApiError(e);
	}
}

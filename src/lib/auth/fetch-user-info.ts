"use server";

import { AuthenticatedUser } from "@/types/user";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

/**
 * Fetch the authenticated caller's profile + appointments via the
 * `public.authenticated_user_info` view.
 *
 * Row-level security on the view (`security_invoker = on`,
 * `internal.auth_user_id() = id`) restricts the result to the caller, so no
 * explicit `.eq("email", …)` / `.eq("id", …)` filter is needed. Use
 * `.maybeSingle()` so unauthenticated callers receive `null` instead of an
 * exception when the view yields no rows.
 *
 * See: intranet-wiki/wiki/entity/view/public.authenticated_user_info.md
 */
export async function fetchUserInfo(): Promise<AuthenticatedUser | null> {
	noStore();
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("authenticated_user_info")
		.select(
			"id, email, name, room, points, profile_photo_path, appointments, is_admin, is_jcrc, is_culture_sports_admin",
		)
		.maybeSingle();

	if (error) {
		console.error("Error retrieving authenticated user info:", error);
		return null;
	}
	if (!data) {
		return null;
	}

	const publicUrl = data.profile_photo_path
		? supabase.storage.from("user-profile-pictures").getPublicUrl(data.profile_photo_path).data
				.publicUrl
		: null;

	const userInfo: AuthenticatedUser = {
		id: data.id,
		email: data.email,
		name: data.name,
		room: data.room,
		points: data.points,
		profile_photo_url: publicUrl,
		is_admin: data.is_admin,
		is_jcrc: data.is_jcrc,
		is_culture_sports_admin: data.is_culture_sports_admin,
		appointments: data.appointments ?? [],
	};

	return userInfo;
}

/**
 * Get the authenticated user's ID using the active Supabase session.
 *
 * Resolves through `public.authenticated_user_info`, which is gated by
 * `internal.auth_user_id()`. Unauthenticated callers receive `null`.
 *
 * The previous implementation tried `app_user_id`/`intranet_user_id`/
 * `internal_user_id` JWT claims first, but the new Supabase auth path does
 * not emit those claims — the DB derives the id from `auth.email()`
 * server-side. The claim fast path is removed.
 */
export async function fetchUserId(): Promise<number | null> {
	noStore();
	const supabase = await createClient();

	const { data, error } = await supabase.from("authenticated_user_info").select("id").maybeSingle();

	if (error) {
		console.error("Error retrieving user ID from database:", error);
		return null;
	}

	return data?.id ?? null;
}

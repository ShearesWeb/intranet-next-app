"use server";

import { AuthenticatedUser } from "@/types/user";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

/**
 * Fetch the authenticated caller's profile + appointments via the
 * `public.my_profile` view.
 *
 * The view is `security_invoker = on` and filters on
 * `internal.auth_user_id() = id`, so it returns at most one row and needs no
 * explicit filter. Use `.maybeSingle()` so unauthenticated callers receive
 * `null` rather than an exception.
 *
 * See: intranet/docs/api/core.md#my_profile
 */
export async function fetchUserInfo(): Promise<AuthenticatedUser | null> {
	noStore();
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("my_profile")
		.select(
			"id, email, name, room, points, profile_photo_path, telegram_handle, stay_period, matric, is_chair, is_jcrc, appointments",
		)
		.maybeSingle();

	if (error) {
		console.error("Error retrieving my_profile:", error);
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
		points: data.points ?? 0,
		profile_photo_url: publicUrl,
		telegram_handle: data.telegram_handle,
		stay_period: data.stay_period,
		matric: data.matric,
		is_chair: data.is_chair,
		is_jcrc: data.is_jcrc,
		appointments: data.appointments ?? [],
	};

	return userInfo;
}

/**
 * Get the authenticated user's ID using the active Supabase session.
 *
 * Resolves through `public.my_profile`, which is gated by
 * `internal.auth_user_id()`. Unauthenticated callers receive `null`.
 */
export async function fetchUserId(): Promise<number | null> {
	noStore();
	const supabase = await createClient();

	const { data, error } = await supabase.from("my_profile").select("id").maybeSingle();

	if (error) {
		console.error("Error retrieving user ID from database:", error);
		return null;
	}

	return data?.id ?? null;
}

import { fetchUserInfo } from "@/lib/auth/fetch-user-info";
import { checkCcaAuthorization } from "@/lib/cca/cca-chair-access";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "./errors";

export async function requireAuth() {
	const user = await fetchUserInfo();
	if (!user) throw new ApiError(401, "Unauthorized");
	return user;
}

/**
 * Authoritative chair guard. Supplies a client so `can_manage_cca` is consulted
 * rather than trusting the profile hint, which cannot see cross-CCA reporting.
 */
export async function requireChairAccess(ccaId: number) {
	const user = await requireAuth();
	const supabase = await createClient();
	const result = await checkCcaAuthorization({
		requestingUser: user,
		cca: { id: ccaId, name: null },
		require: "chair",
		supabase,
	});
	if (!result.ok) throw new ApiError(result.status, result.error);
	return user;
}

export async function requireJcrcAccess() {
	const user = await requireAuth();
	if (!user.is_jcrc) throw new ApiError(403, "Not authorized. JCRC access only.");
	return user;
}

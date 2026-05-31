import { fetchUserInfo } from "@/lib/auth/fetch-user-info";
import { checkCcaAuthorization } from "@/lib/cca/cca-chair-access";
import { ApiError } from "./errors";

export async function requireAuth() {
	const user = await fetchUserInfo();
	if (!user) throw new ApiError(401, "Unauthorized");
	return user;
}

export async function requireChairAccess(ccaId: number) {
	const user = await requireAuth();
	const result = await checkCcaAuthorization({
		requestingUser: user,
		cca: { id: ccaId, name: null, cca_type: null },
		require: "chair",
	});
	if (!result.ok) throw new ApiError(result.status, result.error);
	return user;
}

export async function requireJcrcAccess() {
	const user = await requireAuth();
	if (!user.is_jcrc) throw new ApiError(403, "Unauthorized");
	return user;
}

export async function requireJcrcOrAdminAccess() {
	const user = await requireAuth();
	if (!user.is_jcrc && !user.is_admin) throw new ApiError(403, "Not authorized. JCRC access only.");
	return user;
}

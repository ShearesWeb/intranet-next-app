import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { deleteClaim, getClaim } from "@/lib/facilities/facility-claims";
import { isChairOfCca, canManageFacilities } from "@/lib/facilities/facility-access";

export const dynamic = "force-dynamic";

async function authorizeClaim(claimId: number) {
	const user = await requireAuth();
	const claim = await getClaim(claimId);
	if (!claim) throw { handled: apiError("Claim not found", 404) };
	if (!isChairOfCca(user, claim.cca_id) && !canManageFacilities(user)) {
		throw { handled: apiError("Not authorized to modify this claim", 403) };
	}
	return user;
}

/** Withdraw a claim — delete the row; the booking reopens via trigger. */
async function withdraw(claimId: number) {
	await authorizeClaim(claimId);
	await deleteClaim(claimId);
	return apiOk({ success: true });
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;
	try {
		const { id } = await params;
		return await withdraw(Number(id));
	} catch (e) {
		if (e && typeof e === "object" && "handled" in e) return (e as { handled: Response }).handled;
		return handleApiError(e);
	}
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;
	try {
		const { id } = await params;
		return await withdraw(Number(id));
	} catch (e) {
		if (e && typeof e === "object" && "handled" in e) return (e as { handled: Response }).handled;
		return handleApiError(e);
	}
}

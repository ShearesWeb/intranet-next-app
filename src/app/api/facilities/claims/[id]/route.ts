import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { deleteClaim, getClaim } from "@/lib/facilities/facility-claims";
import { canBookForCca } from "@/lib/facilities/booking-ccas";
import { canManageFacilities } from "@/lib/facilities/facility-access";

export const dynamic = "force-dynamic";

async function authorizeClaim(claimId: number) {
	const user = await requireAuth();
	const claim = await getClaim(claimId);
	if (!claim) throw { handled: apiError("Claim not found", 404) };
	if (!canManageFacilities(user) && !(await canBookForCca(user, claim.cca_id))) {
		throw { handled: apiError("Not authorized to modify this claim", 403) };
	}
	return user;
}

/** Withdraw a claim by deleting its row, which reopens the slot. */
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

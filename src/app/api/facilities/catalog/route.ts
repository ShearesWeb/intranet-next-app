import { requireAuth, requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getFacilityType, listFacilities, updateFacility } from "@/lib/facilities/facility-catalog";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireAuth();
		const facilities = await listFacilities({ type: "sheares" });
		return apiOk(facilities);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function PATCH(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { id, active, venue, sub_venue } = await req.json();

		if (id == null) return apiError("id is required", 400);
		if ((await getFacilityType(id)) !== "sheares") {
			return apiError("Only Sheares facilities can be managed", 403);
		}

		const patch: { active?: boolean; venue?: string; sub_venue?: string } = {};
		if (active !== undefined) patch.active = active;
		if (venue !== undefined) patch.venue = venue;
		if (sub_venue !== undefined) patch.sub_venue = sub_venue;

		const facility = await updateFacility(id, patch);
		return apiOk(facility);
	} catch (e) {
		return handleApiError(e);
	}
}

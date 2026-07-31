import { requireAuth, requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { listFacilities, createFacility, updateFacility } from "@/lib/facilities/facility-catalog";
import { FacilityType } from "@/types/facilities";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const VALID_TYPES: FacilityType[] = ["sheares", "reboks", "nus", "external"];

export async function GET(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireAuth();
		const typeParam = req.nextUrl.searchParams.get("type");
		const activeOnly = req.nextUrl.searchParams.get("active") === "true";
		const type = VALID_TYPES.includes(typeParam as FacilityType)
			? (typeParam as FacilityType)
			: undefined;

		const facilities = await listFacilities({ type, activeOnly });
		return apiOk(facilities);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { type, venue, sub_venue } = await req.json();

		if (!type || !venue || !sub_venue) {
			return apiError("type, venue and sub_venue are required", 400);
		}
		if (!VALID_TYPES.includes(type)) {
			return apiError("Invalid facility type", 400);
		}

		const facility = await createFacility({ type, venue, sub_venue });
		return apiOk(facility, 201);
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

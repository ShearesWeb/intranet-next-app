import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getClaimsForCca, createClaim } from "@/lib/facilities/facility-claims";
import { isChairOfCca, getChairCcaIds } from "@/lib/facilities/facility-access";
import { getFacilityType } from "@/lib/facilities/facility-catalog";
import { getCurrentNusWeek, getSingaporeDateKey } from "@/lib/nus-academic-calendar";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		const ccaParam = req.nextUrl.searchParams.get("ccaId");

		if (!ccaParam) {
			const chairCcaIds = getChairCcaIds(user);
			if (chairCcaIds.length === 0) return apiOk([]);
			const claims = await getClaimsForCca(chairCcaIds[0]);
			return apiOk(claims.filter((claim) => claim.facility_type === "sheares"));
		}

		const ccaId = Number(ccaParam);
		if (!isChairOfCca(user, ccaId)) {
			return apiError("Not authorized to view this CCA's bookings", 403);
		}
		const claims = await getClaimsForCca(ccaId);
		return apiOk(claims.filter((claim) => claim.facility_type === "sheares"));
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		const { facility_id, date, hour, cca_id } = await req.json();

		if (facility_id == null || !date || hour == null || cca_id == null) {
			return apiError("facility_id, date, hour and cca_id are required", 400);
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return apiError("date must use YYYY-MM-DD format", 400);
		}
		if (hour < 0 || hour > 23) return apiError("hour must be 0–23", 400);
		if (!isChairOfCca(user, cca_id)) {
			return apiError("Not authorized to claim for this CCA", 403);
		}
		if (date < getSingaporeDateKey()) {
			return apiError("Past facility slots cannot be booked", 403);
		}

		const currentWeek = getCurrentNusWeek();
		if (!currentWeek || date < currentWeek.start || date > currentWeek.end) {
			return apiError("Facilities can only be booked for the current NUS teaching week", 403);
		}

		// The slot carries its own date now, so no booking lookup is needed. The
		// DB still checks that a schedule actually publishes it.
		// Read the type from the database so a hand-rolled request cannot bypass
		// the Sheares-only booking boundary. This applies to JCRC callers too.
		const type = await getFacilityType(facility_id);
		if (type !== "sheares") {
			return apiError("Only Sheares facilities can be booked", 403);
		}

		const claim = await createClaim(facility_id, date, hour, cca_id, user.id);
		return apiOk(claim, 201);
	} catch (e) {
		return handleApiError(e);
	}
}

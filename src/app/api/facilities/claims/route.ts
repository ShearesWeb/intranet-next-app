import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getClaimsForCca, createClaim } from "@/lib/facilities/facility-claims";
import { isChairOfCca, getChairCcaIds } from "@/lib/facilities/facility-access";
import { getFacilityType } from "@/lib/facilities/facility-catalog";
import { MIN_BOOKING_LEAD_DAYS, isBookingLocked } from "@/types/facilities";
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
		if (hour < 0 || hour > 23) return apiError("hour must be 0–23", 400);
		if (!isChairOfCca(user, cca_id)) {
			return apiError("Not authorized to claim for this CCA", 403);
		}

		// The slot carries its own date now, so no booking lookup is needed. The
		// DB still checks that a schedule actually publishes it.
		if (isBookingLocked(date)) {
			return apiError(`Bookings lock ${MIN_BOOKING_LEAD_DAYS} days before the slot date`, 403);
		}

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

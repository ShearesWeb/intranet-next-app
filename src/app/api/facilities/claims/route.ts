import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getClaimsForCca, createClaim } from "@/lib/facilities/facility-claims";
import { getBooking } from "@/lib/facilities/facility-bookings";
import { isChairOfCca, getChairCcaIds } from "@/lib/facilities/facility-access";
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
			return apiOk(claims);
		}

		const ccaId = Number(ccaParam);
		if (!isChairOfCca(user, ccaId)) {
			return apiError("Not authorized to view this CCA's bookings", 403);
		}
		const claims = await getClaimsForCca(ccaId);
		return apiOk(claims);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		const { booking_id, cca_id } = await req.json();

		if (booking_id == null || cca_id == null) {
			return apiError("booking_id and cca_id are required", 400);
		}
		if (!isChairOfCca(user, cca_id)) {
			return apiError("Not authorized to claim for this CCA", 403);
		}

		const booking = await getBooking(booking_id);
		if (!booking) return apiError("Booking not found", 404);
		if (isBookingLocked(booking.booked_date)) {
			return apiError(`Bookings lock ${MIN_BOOKING_LEAD_DAYS} days before the slot date`, 403);
		}

		const claim = await createClaim(booking_id, cca_id, user.id);
		return apiOk(claim, 201);
	} catch (e) {
		return handleApiError(e);
	}
}

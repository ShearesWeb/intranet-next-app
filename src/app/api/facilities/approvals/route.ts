import { requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	listPendingApprovals,
	listUpcomingConfirmed,
	approveClaim,
	rejectAllClaims,
	revokeBooking,
} from "@/lib/facilities/facility-approvals";
import { todayKey } from "@/lib/date";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** JCRC approvals queue: bookings awaiting approval + upcoming confirmed (revocable). */
export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const [pending, confirmed] = await Promise.all([
			listPendingApprovals(),
			listUpcomingConfirmed(todayKey()),
		]);
		return apiOk({ pending, confirmed });
	} catch (e) {
		return handleApiError(e);
	}
}

/** JCRC acts on a booking: approve one claim, reject all claims, or revoke a confirmed booking. */
export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireJcrcAccess();
		const { action, booking_id, winning_claim_id } = await req.json();

		if (booking_id == null) return apiError("booking_id is required", 400);

		if (action === "approve") {
			if (winning_claim_id == null) {
				return apiError("winning_claim_id is required to approve", 400);
			}
			await approveClaim(booking_id, winning_claim_id, user.id);
		} else if (action === "reject") {
			await rejectAllClaims(booking_id, user.id);
		} else if (action === "revoke") {
			await revokeBooking(booking_id, user.id);
		} else {
			return apiError("action must be approve, reject or revoke", 400);
		}

		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

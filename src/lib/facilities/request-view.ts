import { isBookableFacilityType } from "@/lib/facilities/bookable-types";
import { GridClaim, groupClaimSegments } from "@/lib/facilities/booking-grid";
import { ConfirmedBookingView, SlotApprovalView } from "@/types/facilities";

export interface ApprovalsPayload {
	pending: SlotApprovalView[];
	confirmed: ConfirmedBookingView[];
}

export interface ReviewClaim extends GridClaim {
	chair_name: string;
	chair_telegram: string;
	requested_at: string | null;
}

/** Each outstanding hourly claim, flattened out of the slot-keyed queue. */
export function pendingClaims(approvals: ApprovalsPayload): ReviewClaim[] {
	return approvals.pending
		.filter((approval) => isBookableFacilityType(approval.slot.type))
		.flatMap((approval) =>
			approval.claimants.map((claimant) => ({
				claim_id: claimant.claim.claim_id,
				facility_id: approval.slot.facility_id,
				date: approval.slot.date,
				hour: approval.slot.hour,
				cca_id: claimant.claim.cca_id,
				cca_name: claimant.cca_name,
				status: "pending" as const,
				chair_name: claimant.chair_name,
				chair_telegram: claimant.chair_telegram,
				requested_at: claimant.requested_at,
			})),
		);
}

/** Each upcoming approved hourly claim. */
export function confirmedClaims(approvals: ApprovalsPayload): ReviewClaim[] {
	return approvals.confirmed
		.filter((booking) => isBookableFacilityType(booking.slot.type))
		.map((booking) => ({
			claim_id: booking.claim_id,
			facility_id: booking.slot.facility_id,
			date: booking.slot.date,
			hour: booking.slot.hour,
			cca_id: booking.slot.claims.find((claim) => claim.claim_id === booking.claim_id)?.cca_id ?? 0,
			cca_name: booking.cca_name,
			status: "approved" as const,
			chair_name: booking.chair_name,
			chair_telegram: "",
			requested_at: null,
		}));
}

export function pendingRequestCount(approvals: ApprovalsPayload): number {
	return groupClaimSegments(pendingClaims(approvals)).length;
}

export type BookingType = "sheares" | "reboks" | "nus" | "external";

export interface FacilityBooking {
	id: number;
	booked_date: string;
	venue: string;
	sub_venue: string;
	activity: string;
	time_from: string;
	time_to: string;
	type: BookingType;
	remark: string | null;
}

export const BOOKING_TYPE_CONFIG: Record<BookingType, { label: string; color: string }> = {
	sheares: { label: "Sheares", color: "#e97316" },
	reboks: { label: "Reboks", color: "#3b82f6" },
	nus: { label: "NUS", color: "#8b5cf6" },
	external: { label: "External", color: "#10b981" },
};

export type ClaimStatus = "pending" | "approved" | "conflicted" | "yielded" | "cancelled";

export const CLAIM_STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string }> = {
	pending: { label: "Pending", color: "#fbbf24" },
	approved: { label: "Approved", color: "#10b981" },
	conflicted: { label: "Conflict", color: "#f87171" },
	yielded: { label: "Yielded", color: "#94a3b8" },
	cancelled: { label: "Cancelled", color: "#94a3b8" },
};

export interface FacilityClaim {
	id: number;
	facility_id: number;
	cca_id: number;
	cca_name: string;
	activity: string;
	status: ClaimStatus;
	recurrence_group: string | null;
	claimed_by: string;
	claimed_at: string;
	resolved_at: string | null;
	resolved_by: string | null;
}

export interface FacilitySlotWithClaims extends FacilityBooking {
	claims: FacilityClaim[];
	user_cca_claim: FacilityClaim | null;
}

export type SlotDisplayStatus = "available" | "your-cca" | "taken" | "conflict" | "pending";

export interface ConflictClaimant {
	claim: FacilityClaim;
	cca_name: string;
	chair_name: string;
	chair_telegram: string;
}

export interface ConflictView {
	facility: FacilityBooking;
	claimants: ConflictClaimant[];
	days_until_booking: number;
	escalated: boolean;
}

export interface CreateClaimPayload {
	facility_id: number;
	cca_id: number;
	activity: string;
}

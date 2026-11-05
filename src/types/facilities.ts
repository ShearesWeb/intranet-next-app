export type FacilityType = "sheares" | "reboks" | "nus" | "external";

/**
 * `enum.slot_status` — the derived state of a computed slot, returned by
 * `facility_slots()`. No table stores it. Renamed from `booking_status`.
 */
export type SlotStatus = "available" | "pending" | "conflicted" | "confirmed";

/**
 * `enum.claim_status`. There is no `cancelled` state any more: withdrawing a
 * claim deletes the row, so a withdrawn booking leaves nothing behind.
 */
export type ClaimStatus = "pending" | "approved" | "rejected";

/** Venue catalog row. */
export interface Facility {
	id: number;
	venue: string;
	sub_venue: string;
	type: FacilityType;
}

/**
 * Recurring weekly availability JCRC publishes. One row per
 * (facility_id, day_of_week, hour); a single row covers every matching date in
 * its window.
 */
export interface FacilitySchedule {
	id: number;
	facility_id: number;
	day_of_week: number; // 0=Sun … 6=Sat
	hour: number; // 0–23
	start_date: string | null; // YYYY-MM-DD; null = unbounded
	end_date: string | null; // YYYY-MM-DD; null = unbounded
}

/**
 * A CCA's booking of one facility, date and hour.
 *
 * The slot lives on the claim itself — there is no booking row to reference,
 * because slots are computed from schedules and never stored.
 */
export interface FacilityClaim {
	id: number;
	facility_id: number;
	/** The date of the slot, not the date the claim was made. */
	date: string;
	hour: number;
	cca_id: number;
	status: ClaimStatus;
	created_by: number | null;
	created_at: string;
	decided_at: string | null;
	decided_by: number | null;
}

/** A claim as embedded in a `facility_slots()` row. */
export interface SlotClaim {
	claim_id: number;
	cca_id: number;
	cca_name: string;
	status: ClaimStatus;
	created_by: number | null;
}

/** One row of `facility_slots(p_from, p_to)`. */
export interface FacilitySlot {
	facility_id: number;
	venue: string;
	sub_venue: string;
	type: FacilityType;
	date: string;
	hour: number;
	status: SlotStatus;
	live_claims: number;
	claims: SlotClaim[];
}

export interface ApprovalClaimant {
	claim: SlotClaim;
	cca_name: string;
	chair_name: string;
	chair_telegram: string;
	/** When the claim was made; null if it could not be read. */
	requested_at: string | null;
}

/** A slot awaiting JCRC approval (one or more competing claims). */
export interface SlotApprovalView {
	slot: FacilitySlot;
	claimants: ApprovalClaimant[];
}

/** An upcoming confirmed booking JCRC can revoke. */
export interface ConfirmedBookingView {
	slot: FacilitySlot;
	cca_name: string;
	chair_name: string;
	claim_id: number;
}

/** weekday index (0=Sun) for a YYYY-MM-DD date string, local-safe. */
export function weekdayOf(dateStr: string): number {
	return new Date(dateStr + "T00:00:00").getDay();
}

/** Whole days from `now` (defaults to today) until a YYYY-MM-DD date, local-safe. */
export function daysUntilBooking(dateStr: string, now: Date = new Date()): number {
	const target = new Date(dateStr + "T00:00:00");
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * The widest window `facility_slots()` accepts, inclusive at both ends.
 *
 * The function raises past this. Keep calendar queries far below it anyway: cost
 * is linear in slots returned, and a year of a full weekly grid is ~88k rows.
 */
export const MAX_SLOT_WINDOW_DAYS = 366;

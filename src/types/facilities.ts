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

export const FACILITY_TYPE_CONFIG: Record<FacilityType, { label: string; color: string }> = {
	sheares: { label: "Sheares", color: "#e97316" },
	reboks: { label: "Reboks", color: "#3b82f6" },
	nus: { label: "NUS", color: "#8b5cf6" },
	external: { label: "External", color: "#10b981" },
};

export const SLOT_STATUS_CONFIG: Record<SlotStatus, { label: string; color: string }> = {
	available: { label: "Available", color: "#10b981" },
	pending: { label: "Pending", color: "#f59e0b" },
	conflicted: { label: "Conflict", color: "#ef4444" },
	confirmed: { label: "Confirmed", color: "#3b82f6" },
};

export const CLAIM_STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string }> = {
	pending: { label: "Pending", color: "#f59e0b" },
	approved: { label: "Approved", color: "#10b981" },
	rejected: { label: "Rejected", color: "#ef4444" },
};

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
 *
 * The old `priority` and `reboks_activity` columns did not survive the rebuild.
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
 * Availability published for one date rather than a weekday — the sibling of
 * `FacilitySchedule`, differing only in recurrence. One row per
 * (facility_id, date, hour).
 *
 * Read-only here: the REBOKS booking bot is the only writer, and the app has no
 * write grant. `facility_slots()` unions these with the recurring rows, so the
 * calendar picks them up without a second query.
 */
export interface FacilitySingleSchedule {
	id: number;
	facility_id: number;
	date: string; // YYYY-MM-DD
	hour: number; // 0–23
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

export interface SlotWithContext extends FacilitySlot {
	/** The caller's own CCAs' claim on this slot, if any. */
	user_cca_claim: SlotClaim | null;
}

/** Stable client-side identity for a computed slot. */
export function slotKey(facilityId: number, slotDate: string, hour: number): string {
	return `${facilityId}:${slotDate}:${hour}`;
}

export interface ApprovalClaimant {
	claim: SlotClaim;
	cca_name: string;
	chair_name: string;
	chair_telegram: string;
}

/** A slot awaiting JCRC approval (one or more competing claims). */
export interface SlotApprovalView {
	slot: FacilitySlot;
	claimants: ApprovalClaimant[];
	days_until_booking: number;
}

/** An upcoming confirmed booking JCRC can revoke. */
export interface ConfirmedBookingView {
	slot: FacilitySlot;
	cca_name: string;
	claim_id: number;
	days_until_booking: number;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "18" → "6:00 PM" */
export function formatHour(hour: number): string {
	const ampm = hour >= 12 ? "PM" : "AM";
	const display = hour % 12 || 12;
	return `${display}:00 ${ampm}`;
}

/** "18" → "6:00 PM – 7:00 PM" (slots are one hour). */
export function formatHourRange(hour: number): string {
	return `${formatHour(hour)} – ${formatHour((hour + 1) % 24)}`;
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

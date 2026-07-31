export type FacilityType = "sheares" | "reboks" | "nus" | "external";

// facility_bookings.status — DERIVED by a DB trigger from claims. Never written directly by the app.
export type BookingStatus = "available" | "pending" | "conflicted" | "confirmed";

export type ClaimStatus = "pending" | "approved" | "rejected" | "cancelled";

export const FACILITY_TYPE_CONFIG: Record<FacilityType, { label: string; color: string }> = {
	sheares: { label: "Sheares", color: "#e97316" },
	reboks: { label: "Reboks", color: "#3b82f6" },
	nus: { label: "NUS", color: "#8b5cf6" },
	external: { label: "External", color: "#10b981" },
};

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; color: string }> = {
	available: { label: "Available", color: "#10b981" },
	pending: { label: "Pending", color: "#f59e0b" },
	conflicted: { label: "Conflict", color: "#ef4444" },
	confirmed: { label: "Confirmed", color: "#3b82f6" },
};

export const CLAIM_STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string }> = {
	pending: { label: "Pending", color: "#f59e0b" },
	approved: { label: "Approved", color: "#10b981" },
	rejected: { label: "Rejected", color: "#ef4444" },
	cancelled: { label: "Cancelled", color: "#94a3b8" },
};

/** Venue catalog row. */
export interface Facility {
	id: number;
	venue: string;
	sub_venue: string;
	type: FacilityType;
	active: boolean;
}

/** Recurring weekly recipe — one (facility, weekday, hour) the bot/app generates bookings from. */
export interface BookingSchedule {
	id: number;
	facility_id: number;
	day_of_week: number; // 0=Sun … 6=Sat
	hour: number; // 0–23
	priority: number; // wave order; lower fires first (default 100)
	reboks_activity: string | null; // REBOKS activity name for ID resolution; null for other types
	start_date: string | null; // YYYY-MM-DD; null = unbounded
	end_date: string | null; // YYYY-MM-DD; null = unbounded
}

/** A CCA's bid on a booking. */
export interface FacilityClaim {
	id: number;
	booking_id: number;
	cca_id: number;
	cca_name: string;
	status: ClaimStatus;
	claimed_by: number;
	claimed_at: string;
	resolved_at: string | null;
	resolved_by: number | null;
}

/** One dated hourly slot, flattened with its facility for display. */
export interface FacilityBooking {
	id: number;
	facility_id: number;
	venue: string;
	sub_venue: string;
	type: FacilityType;
	booked_date: string;
	hour: number;
	status: BookingStatus;
}

export interface BookingWithClaims extends FacilityBooking {
	claims: FacilityClaim[];
	user_cca_claim: FacilityClaim | null;
	/** Derived: a booking_schedules row matches (facility_id, weekday-of(booked_date), hour). */
	recurring: boolean;
}

export interface ApprovalClaimant {
	claim: FacilityClaim;
	cca_name: string;
	chair_name: string;
	chair_telegram: string;
}

/** A booking awaiting JCRC approval (one or more competing claims). */
export interface BookingApprovalView {
	booking: FacilityBooking;
	claimants: ApprovalClaimant[];
	days_until_booking: number;
}

/** An upcoming confirmed booking JCRC can revoke. */
export interface ConfirmedBookingView {
	booking: FacilityBooking;
	cca_name: string;
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

/** Chairs must book at least this many days ahead; closer slots are locked. */
export const MIN_BOOKING_LEAD_DAYS = 3;

/** Whole days from `now` (defaults to today) until a YYYY-MM-DD date, local-safe. */
export function daysUntilBooking(dateStr: string, now: Date = new Date()): number {
	const target = new Date(dateStr + "T00:00:00");
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** True when the slot is within the lead-time window — claims and withdrawals are locked. */
export function isBookingLocked(dateStr: string, now: Date = new Date()): boolean {
	return daysUntilBooking(dateStr, now) < MIN_BOOKING_LEAD_DAYS;
}

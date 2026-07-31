import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import {
	BookingApprovalView,
	ConfirmedBookingView,
	ApprovalClaimant,
	FacilityBooking,
	FacilityClaim,
	FacilityType,
	BookingStatus,
	ClaimStatus,
	daysUntilBooking,
} from "@/types/facilities";

interface BookingRow {
	id: number;
	facility_id: number;
	booked_date: string;
	hour: number;
	status: BookingStatus;
	facilities: { venue: string; sub_venue: string; type: FacilityType } | null;
}

function flattenBooking(row: BookingRow): FacilityBooking {
	return {
		id: row.id,
		facility_id: row.facility_id,
		venue: row.facilities?.venue ?? "",
		sub_venue: row.facilities?.sub_venue ?? "",
		type: row.facilities?.type ?? "external",
		booked_date: row.booked_date,
		hour: row.hour,
		status: row.status,
	};
}

/** Every booking with outstanding claims (single or competing), with claimants + chair contacts. */
export async function listPendingApprovals(): Promise<BookingApprovalView[]> {
	const supabase = await createClient();

	const { data: bookings, error } = await supabase
		.from("facility_bookings")
		.select("*, facilities(venue, sub_venue, type)")
		.in("status", ["pending", "conflicted"])
		.order("booked_date")
		.order("hour");

	if (error) {
		console.error("Error fetching bookings awaiting approval:", error);
		throw new ApiError(500, "Failed to load approvals");
	}
	if (!bookings || bookings.length === 0) return [];

	const bookingIds = bookings.map((b) => b.id);

	const { data: claimRows } = await supabase
		.from("facility_claims")
		.select("*, ccas(name)")
		.in("booking_id", bookingIds)
		.eq("status", "pending");

	const claimerIds = [...new Set((claimRows ?? []).map((c) => c.claimed_by))];
	const contacts = new Map<number, { name: string; telegram: string }>();
	if (claimerIds.length > 0) {
		const { data: users } = await supabase
			.from("users")
			.select("id, name, telegram_handle")
			.in("id", claimerIds);
		for (const u of users ?? []) {
			contacts.set(u.id, { name: u.name ?? "", telegram: u.telegram_handle ?? "" });
		}
	}

	const claimantsByBooking = new Map<number, ApprovalClaimant[]>();
	for (const row of claimRows ?? []) {
		const claim: FacilityClaim = {
			id: row.id,
			booking_id: row.booking_id,
			cca_id: row.cca_id,
			cca_name: (row.ccas as { name: string } | null)?.name ?? "Unknown CCA",
			status: row.status as ClaimStatus,
			claimed_by: row.claimed_by,
			claimed_at: row.claimed_at,
			resolved_at: row.resolved_at,
			resolved_by: row.resolved_by,
		};
		const contact = contacts.get(row.claimed_by);
		const claimant: ApprovalClaimant = {
			claim,
			cca_name: claim.cca_name,
			chair_name: contact?.name ?? "",
			chair_telegram: contact?.telegram ?? "",
		};
		const list = claimantsByBooking.get(row.booking_id) ?? [];
		list.push(claimant);
		claimantsByBooking.set(row.booking_id, list);
	}

	return bookings.map((row) => {
		const booking = flattenBooking(row as BookingRow);
		return {
			booking,
			claimants: claimantsByBooking.get(row.id) ?? [],
			days_until_booking: daysUntilBooking(row.booked_date),
		};
	});
}

/** Upcoming confirmed bookings (today onward) with the holding CCA — JCRC can revoke these. */
export async function listUpcomingConfirmed(fromDate: string): Promise<ConfirmedBookingView[]> {
	const supabase = await createClient();

	const { data: bookings, error } = await supabase
		.from("facility_bookings")
		.select("*, facilities(venue, sub_venue, type)")
		.eq("status", "confirmed")
		.gte("booked_date", fromDate)
		.order("booked_date")
		.order("hour");

	if (error) {
		console.error("Error fetching confirmed bookings:", error);
		throw new ApiError(500, "Failed to load confirmed bookings");
	}
	if (!bookings || bookings.length === 0) return [];

	const { data: claimRows } = await supabase
		.from("facility_claims")
		.select("booking_id, ccas(name)")
		.in(
			"booking_id",
			bookings.map((b) => b.id),
		)
		.eq("status", "approved");

	const ccaByBooking = new Map<number, string>();
	for (const row of claimRows ?? []) {
		const cca = row.ccas as { name: string } | { name: string }[] | null;
		const name = Array.isArray(cca) ? cca[0]?.name : cca?.name;
		ccaByBooking.set(row.booking_id, name ?? "Unknown CCA");
	}

	return bookings.map((row) => ({
		booking: flattenBooking(row as BookingRow),
		cca_name: ccaByBooking.get(row.id) ?? "Unknown CCA",
		days_until_booking: daysUntilBooking(row.booked_date),
	}));
}

/** Approve the winning claim and reject the rest. Booking flips to 'confirmed' via trigger. */
export async function approveClaim(
	bookingId: number,
	winningClaimId: number,
	userId: number,
): Promise<void> {
	const supabase = await createClient();
	const now = new Date().toISOString();

	const { error: approveError } = await supabase
		.from("facility_claims")
		.update({ status: "approved", resolved_at: now, resolved_by: userId })
		.eq("id", winningClaimId)
		.eq("booking_id", bookingId);

	if (approveError) {
		console.error("Error approving winning claim:", approveError);
		throw new ApiError(500, "Failed to approve claim");
	}

	const { error: rejectError } = await supabase
		.from("facility_claims")
		.update({ status: "rejected", resolved_at: now, resolved_by: userId })
		.eq("booking_id", bookingId)
		.eq("status", "pending")
		.neq("id", winningClaimId);

	if (rejectError) {
		console.error("Error rejecting other claims:", rejectError);
		throw new ApiError(500, "Failed to reject competing claims");
	}
}

/** Reject every pending claim on a booking. Slot returns to 'available' via trigger. */
export async function rejectAllClaims(bookingId: number, userId: number): Promise<void> {
	const supabase = await createClient();

	const { error } = await supabase
		.from("facility_claims")
		.update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: userId })
		.eq("booking_id", bookingId)
		.eq("status", "pending");

	if (error) {
		console.error("Error rejecting claims:", error);
		throw new ApiError(500, "Failed to reject claims");
	}
}

/**
 * Revoke a confirmed booking: reject its approved claim(s). The status trigger rolls the
 * booking back (any still-pending claims resurface for approval, else 'available').
 */
export async function revokeBooking(bookingId: number, userId: number): Promise<void> {
	const supabase = await createClient();

	const { error } = await supabase
		.from("facility_claims")
		.update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: userId })
		.eq("booking_id", bookingId)
		.eq("status", "approved");

	if (error) {
		console.error("Error revoking booking:", error);
		throw new ApiError(500, "Failed to revoke booking");
	}
}

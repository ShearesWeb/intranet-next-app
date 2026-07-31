import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import {
	FacilityClaim,
	ClaimStatus,
	FacilityBooking,
	FacilityType,
	BookingStatus,
} from "@/types/facilities";

export interface ClaimWithBooking extends FacilityClaim {
	booking: FacilityBooking | null;
}

/** All claims a CCA has made, newest first, with the booking + facility joined in. */
export async function getClaimsForCca(ccaId: number): Promise<ClaimWithBooking[]> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.select(
			"*, ccas(name), facility_bookings(id, facility_id, booked_date, hour, status, facilities(venue, sub_venue, type))",
		)
		.eq("cca_id", ccaId)
		.order("claimed_at", { ascending: false });

	if (error) {
		console.error("Error fetching CCA claims:", error);
		throw new ApiError(500, "Failed to load your CCA's bookings");
	}

	return (data ?? []).map((row) => {
		const b = row.facility_bookings as {
			id: number;
			facility_id: number;
			booked_date: string;
			hour: number;
			status: BookingStatus;
			facilities: { venue: string; sub_venue: string; type: FacilityType } | null;
		} | null;
		const booking: FacilityBooking | null = b
			? {
					id: b.id,
					facility_id: b.facility_id,
					venue: b.facilities?.venue ?? "",
					sub_venue: b.facilities?.sub_venue ?? "",
					type: b.facilities?.type ?? "external",
					booked_date: b.booked_date,
					hour: b.hour,
					status: b.status,
				}
			: null;

		return {
			id: row.id,
			booking_id: row.booking_id,
			cca_id: row.cca_id,
			cca_name: (row.ccas as { name: string } | null)?.name ?? "Unknown CCA",
			status: row.status as ClaimStatus,
			claimed_by: row.claimed_by,
			claimed_at: row.claimed_at,
			resolved_at: row.resolved_at,
			resolved_by: row.resolved_by,
			booking,
		};
	});
}

/**
 * Place a bid on a booking. The booking's status is recomputed by a DB trigger — the app
 * never writes facility_bookings.status directly.
 */
export async function createClaim(
	bookingId: number,
	ccaId: number,
	userId: number,
): Promise<FacilityClaim> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.insert({ booking_id: bookingId, cca_id: ccaId, claimed_by: userId })
		.select("*, ccas(name)")
		.single();

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "Your CCA has already claimed this slot");
		}
		console.error("Error creating claim:", error);
		throw new ApiError(500, "Failed to claim slot — check RLS policies on facility_claims");
	}

	return {
		id: data.id,
		booking_id: data.booking_id,
		cca_id: data.cca_id,
		cca_name: (data.ccas as { name: string } | null)?.name ?? "Unknown CCA",
		status: data.status as ClaimStatus,
		claimed_by: data.claimed_by,
		claimed_at: data.claimed_at,
		resolved_at: data.resolved_at,
		resolved_by: data.resolved_by,
	};
}

/**
 * Withdraw = delete the claim row. The status trigger reopens the booking, and the
 * (booking, cca) unique slot frees up so the CCA can claim the same slot again later.
 */
export async function deleteClaim(claimId: number): Promise<void> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.delete()
		.eq("id", claimId)
		.select("id")
		.single();

	if (error || !data) {
		console.error("Error withdrawing claim:", error);
		throw new ApiError(500, "Failed to withdraw claim — check RLS policies on facility_claims");
	}
}

export async function getClaim(claimId: number): Promise<{
	id: number;
	cca_id: number;
	booking_id: number;
	booked_date: string | null;
} | null> {
	const supabase = await createClient();
	const { data } = await supabase
		.from("facility_claims")
		.select("id, cca_id, booking_id, facility_bookings(booked_date)")
		.eq("id", claimId)
		.single();
	if (!data) return null;
	const booking = data.facility_bookings as
		| { booked_date: string }
		| { booked_date: string }[]
		| null;
	const booked_date = Array.isArray(booking)
		? (booking[0]?.booked_date ?? null)
		: (booking?.booked_date ?? null);
	return { id: data.id, cca_id: data.cca_id, booking_id: data.booking_id, booked_date };
}

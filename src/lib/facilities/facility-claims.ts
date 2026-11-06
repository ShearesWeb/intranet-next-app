import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { unwrapRelation } from "@/lib/supabase/helpers";
import { FacilityClaim, FacilityType } from "@/types/facilities";

export interface ClaimWithFacility extends FacilityClaim {
	cca_name: string;
	venue: string;
	sub_venue: string;
	facility_type: FacilityType;
}

type ClaimRow = FacilityClaim & {
	ccas: { name: string } | { name: string }[] | null;
	facilities:
		| { venue: string; sub_venue: string; type: FacilityType }
		| { venue: string; sub_venue: string; type: FacilityType }[]
		| null;
};

function toClaimWithFacility(row: ClaimRow): ClaimWithFacility {
	const facility = unwrapRelation(row.facilities);

	return {
		id: row.id,
		facility_id: row.facility_id,
		date: row.date,
		hour: row.hour,
		cca_id: row.cca_id,
		status: row.status,
		created_by: row.created_by,
		created_at: row.created_at,
		decided_at: row.decided_at,
		decided_by: row.decided_by,
		cca_name: unwrapRelation(row.ccas)?.name ?? "Unknown CCA",
		venue: facility?.venue ?? "",
		sub_venue: facility?.sub_venue ?? "",
		facility_type: facility?.type ?? "external",
	};
}

const CLAIM_SELECT =
	"id, facility_id, date, hour, cca_id, status, created_by, created_at, decided_at, decided_by, ccas(name), facilities(venue, sub_venue, type)";

/** All claims these CCAs have made, soonest slot first, with the facility joined in. */
export async function getClaimsForCcas(ccaIds: number[]): Promise<ClaimWithFacility[]> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.select(CLAIM_SELECT)
		.in("cca_id", ccaIds)
		.order("date", { ascending: true })
		.order("hour", { ascending: true });

	if (error) {
		console.error("Error fetching CCA claims:", error);
		throw new ApiError(500, "Failed to load your CCA's bookings");
	}

	return ((data ?? []) as unknown as ClaimRow[]).map(toClaimWithFacility);
}

/**
 * Book a slot for a CCA.
 *
 * The slot is identified by (facility_id, date, hour) — there is no
 * booking row to reference. `created_by` must be the caller, which the INSERT
 * policy checks alongside `can_book_for_cca`.
 */
export async function createClaim(
	facilityId: number,
	slotDate: string,
	hour: number,
	ccaId: number,
	userId: number,
): Promise<ClaimWithFacility> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.insert({
			facility_id: facilityId,
			date: slotDate,
			hour,
			cca_id: ccaId,
			created_by: userId,
		})
		.select(CLAIM_SELECT)
		.single();

	if (error) {
		// uq_facility_claims_live: one live claim per CCA per slot.
		if (error.code === "23505") {
			if (error.message.includes("uq_facility_claims_approved_slot")) {
				throw new ApiError(409, "That slot is already confirmed for another CCA");
			}
			throw new ApiError(409, "Your CCA has already claimed this slot");
		}
		// Raised by validate_facility_claim when no schedule publishes the slot.
		if (error.message.includes("No published schedule offers")) {
			throw new ApiError(400, "That slot is not open for booking");
		}
		console.error("Error creating claim:", error);
		throw new ApiError(403, "You are not allowed to book for this CCA");
	}

	return toClaimWithFacility(data as unknown as ClaimRow);
}

/**
 * Book several hours of one slot day at once.
 *
 * A single multi-row INSERT, so a request either lands whole or not at all. A
 * chair is never left holding half of the time they asked for.
 */
export async function createClaims(
	facilityId: number,
	slotDate: string,
	hours: number[],
	ccaId: number,
	userId: number,
): Promise<ClaimWithFacility[]> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.insert(
			hours.map((hour) => ({
				facility_id: facilityId,
				date: slotDate,
				hour,
				cca_id: ccaId,
				created_by: userId,
			})),
		)
		.select(CLAIM_SELECT);

	if (error) {
		if (error.code === "23505") {
			if (error.message.includes("uq_facility_claims_approved_slot")) {
				throw new ApiError(409, "Part of that time is already confirmed for another CCA");
			}
			throw new ApiError(409, "Your CCA has already requested part of that time");
		}
		if (error.message.includes("No published schedule offers")) {
			throw new ApiError(400, "Part of that time is not open for booking");
		}
		console.error("Error creating claims:", error);
		throw new ApiError(403, "You are not allowed to book for this CCA");
	}

	return ((data ?? []) as unknown as ClaimRow[]).map(toClaimWithFacility);
}

/**
 * Withdraw = delete the claim row. There is no `cancelled` status, so this
 * leaves nothing behind and the slot frees up for that CCA to claim again.
 */
export async function deleteClaim(claimId: number): Promise<void> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.delete()
		.eq("id", claimId)
		.select("id")
		.maybeSingle();

	if (error) {
		console.error("Error withdrawing claim:", error);
		throw new ApiError(500, "Failed to withdraw claim");
	}

	// A DELETE the policy filters out matches no rows rather than raising.
	if (!data) {
		throw new ApiError(403, "You are not allowed to withdraw this booking");
	}
}

/**
 * Delete several claims in one statement, so a multi-hour request is withdrawn
 * or revoked whole. The DELETE policy filters rather than raises, so a short
 * count means the caller could not delete all of them.
 */
export async function deleteClaims(claimIds: number[]): Promise<void> {
	if (!claimIds.length) return;

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("facility_claims")
		.delete()
		.in("id", claimIds)
		.select("id");

	if (error) {
		console.error("Error deleting claims:", error);
		throw new ApiError(500, "Failed to withdraw claims");
	}
	if (!data || data.length < new Set(claimIds).size) {
		throw new ApiError(403, "You are not allowed to withdraw this booking");
	}
}

/** The CCA and venue type behind each claim, read in one query. */
export async function getClaimOwners(
	claimIds: number[],
): Promise<
	{ id: number; cca_id: number; facility_id: number; facility_type: FacilityType | null }[]
> {
	if (!claimIds.length) return [];

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("facility_claims")
		.select("id, cca_id, facility_id, facilities(type)")
		.in("id", claimIds);

	if (error) {
		console.error("Error loading claims:", error);
		throw new ApiError(500, "Failed to load claims");
	}

	type OwnerRow = {
		id: number;
		cca_id: number;
		facility_id: number;
		facilities: { type: FacilityType } | { type: FacilityType }[] | null;
	};
	return ((data ?? []) as unknown as OwnerRow[]).map((row) => ({
		id: row.id,
		cca_id: row.cca_id,
		facility_id: row.facility_id,
		facility_type: unwrapRelation(row.facilities)?.type ?? null,
	}));
}

export async function getClaim(claimId: number): Promise<FacilityClaim | null> {
	const supabase = await createClient();

	const { data } = await supabase
		.from("facility_claims")
		.select(
			"id, facility_id, date, hour, cca_id, status, created_by, created_at, decided_at, decided_by",
		)
		.eq("id", claimId)
		.maybeSingle();

	return (data as FacilityClaim | null) ?? null;
}

import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { ClaimStatus, FacilityClaim, FacilityType } from "@/types/facilities";

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

function unwrap<T>(value: T | T[] | null): T | null {
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toClaimWithFacility(row: ClaimRow): ClaimWithFacility {
	const facility = unwrap(row.facilities);

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
		cca_name: unwrap(row.ccas)?.name ?? "Unknown CCA",
		venue: facility?.venue ?? "",
		sub_venue: facility?.sub_venue ?? "",
		facility_type: facility?.type ?? "external",
	};
}

const CLAIM_SELECT =
	"id, facility_id, date, hour, cca_id, status, created_by, created_at, decided_at, decided_by, ccas(name), facilities(venue, sub_venue, type)";

/** All claims a CCA has made, soonest slot first, with the facility joined in. */
export async function getClaimsForCca(ccaId: number): Promise<ClaimWithFacility[]> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.select(CLAIM_SELECT)
		.eq("cca_id", ccaId)
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
 * policy checks alongside `can_manage_cca` or JCRC.
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

/**
 * Approve or reject a claim. JCRC only.
 *
 * A non-JCRC caller is not refused: the UPDATE policy's USING clause filters
 * the row out, so PostgREST returns an empty array. Check the response length
 * rather than looking for an error.
 */
export async function decideClaim(claimId: number, status: ClaimStatus): Promise<FacilityClaim> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_claims")
		.update({ status })
		.eq("id", claimId)
		.select(
			"id, facility_id, date, hour, cca_id, status, created_by, created_at, decided_at, decided_by",
		)
		.maybeSingle();

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "That slot is already confirmed for another CCA");
		}
		console.error("Error deciding claim:", error);
		throw new ApiError(500, "Failed to update claim");
	}

	if (!data) {
		throw new ApiError(403, "Only JCRC may resolve or reopen a facility claim");
	}

	return data as FacilityClaim;
}

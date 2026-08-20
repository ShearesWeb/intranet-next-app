import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { Facility, FacilityType } from "@/types/facilities";

const FACILITY_SELECT = "id, venue, sub_venue, type";

export async function listFacilities(opts?: { type?: FacilityType }): Promise<Facility[]> {
	const supabase = await createClient();

	let query = supabase.from("facilities").select(FACILITY_SELECT).order("venue").order("sub_venue");

	if (opts?.type) query = query.eq("type", opts.type);

	const { data, error } = await query;

	if (error) {
		console.error("Error listing facilities:", error);
		throw new ApiError(500, "Failed to load facilities");
	}

	return (data ?? []) as Facility[];
}

/**
 * One facility's type, for rules that depend on it.
 *
 * Its own query rather than a column on the claim payload: the client must not
 * be able to talk its way past a type-scoped rule by mislabelling the venue.
 * Returns null when no such facility exists, leaving the caller to decide.
 */
export async function getFacilityType(facilityId: number): Promise<FacilityType | null> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facilities")
		.select("type")
		.eq("id", facilityId)
		.maybeSingle();

	if (error) {
		console.error("Error reading facility type:", error);
		throw new ApiError(500, "Failed to load the facility");
	}

	return (data?.type as FacilityType) ?? null;
}

/**
 * Rename a facility.
 *
 * There is no active flag any more. To retire a venue, remove or end-date its
 * schedules: it then offers no further slots while its past bookings stay
 * readable. Deleting it outright is refused once anything has claimed it.
 */
export async function updateFacility(
	id: number,
	patch: { venue?: string; sub_venue?: string },
): Promise<Facility> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("facilities")
		.update(patch)
		.eq("id", id)
		.select(FACILITY_SELECT)
		.single();

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "A facility with that venue and sub-venue already exists");
		}
		console.error("Error updating facility:", error);
		throw new ApiError(500, "Failed to update facility");
	}

	return data as Facility;
}

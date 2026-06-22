import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { Facility, FacilityType } from "@/types/facilities";

export async function listFacilities(opts?: {
	type?: FacilityType;
	activeOnly?: boolean;
}): Promise<Facility[]> {
	const supabase = await createClient();

	let query = supabase.from("facilities").select("*").order("venue").order("sub_venue");

	if (opts?.type) query = query.eq("type", opts.type);
	if (opts?.activeOnly) query = query.eq("active", true);

	const { data, error } = await query;

	if (error) {
		console.error("Error listing facilities:", error);
		throw new ApiError(500, "Failed to load facilities");
	}

	return data ?? [];
}

export async function getFacility(id: number): Promise<Facility | null> {
	const supabase = await createClient();
	const { data, error } = await supabase.from("facilities").select("*").eq("id", id).single();

	if (error) {
		if (error.code === "PGRST116") return null;
		console.error("Error fetching facility:", error);
		throw new ApiError(500, "Failed to load facility");
	}

	return data;
}

/**
 * Create a facility. REBOKS venues have a fixed identity owned by the bot's catalog
 * scrape, so the app refuses to create them — only sheares/nus/external are app-managed.
 */
export async function createFacility(input: {
	type: FacilityType;
	venue: string;
	sub_venue: string;
}): Promise<Facility> {
	if (input.type === "reboks") {
		throw new ApiError(400, "REBOKS facilities cannot be added in-app");
	}

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("facilities")
		.insert({ venue: input.venue, sub_venue: input.sub_venue, type: input.type, active: true })
		.select("*")
		.single();

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "A facility with that venue and sub-venue already exists");
		}
		console.error("Error creating facility:", error);
		throw new ApiError(500, "Failed to create facility");
	}

	return data;
}

/** Patch a facility's editable fields (active toggle, venue rename). */
export async function updateFacility(
	id: number,
	patch: { active?: boolean; venue?: string; sub_venue?: string },
): Promise<Facility> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("facilities")
		.update(patch)
		.eq("id", id)
		.select("*")
		.single();

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "A facility with that venue and sub-venue already exists");
		}
		console.error("Error updating facility:", error);
		throw new ApiError(500, "Failed to update facility");
	}

	return data;
}

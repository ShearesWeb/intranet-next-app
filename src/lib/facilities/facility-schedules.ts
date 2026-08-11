import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { FacilitySchedule } from "@/types/facilities";

/**
 * The recurring weekly availability JCRC publishes.
 *
 * One row per (facility_id, day_of_week, hour), covering every matching date in
 * its window. Writes are gated to JCRC by policy.
 *
 * The old `priority` (wave order) and `reboks_activity` columns did not survive
 * the rebuild, so neither is settable here.
 */
export async function listSchedules(facilityId?: number): Promise<FacilitySchedule[]> {
	const supabase = await createClient();

	let query = supabase
		.from("facility_schedules")
		.select("id, facility_id, day_of_week, hour, start_date, end_date")
		.order("day_of_week")
		.order("hour");

	if (facilityId != null) query = query.eq("facility_id", facilityId);

	const { data, error } = await query;

	if (error) {
		console.error("Error listing facility schedules:", error);
		throw new ApiError(500, "Failed to load schedules");
	}

	return (data ?? []) as FacilitySchedule[];
}

export async function createSchedule(input: {
	facilityId: number;
	dayOfWeek: number;
	hour: number;
	startDate?: string | null;
	endDate?: string | null;
}): Promise<FacilitySchedule> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_schedules")
		.insert({
			facility_id: input.facilityId,
			day_of_week: input.dayOfWeek,
			hour: input.hour,
			start_date: input.startDate ?? null,
			end_date: input.endDate ?? null,
		})
		.select("id, facility_id, day_of_week, hour, start_date, end_date")
		.single();

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "A schedule already exists for that facility, weekday and hour");
		}
		console.error("Error creating facility schedule:", error);
		throw new ApiError(500, "Failed to create schedule");
	}

	return data as FacilitySchedule;
}

/**
 * Patch a schedule's date window.
 *
 * End-dating a row stops future slots appearing and never touches an existing
 * claim, which is how a venue is retired without losing its booking history.
 */
export async function updateSchedule(
	id: number,
	patch: { start_date?: string | null; end_date?: string | null },
): Promise<FacilitySchedule> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_schedules")
		.update(patch)
		.eq("id", id)
		.select("id, facility_id, day_of_week, hour, start_date, end_date")
		.single();

	if (error) {
		console.error("Error updating facility schedule:", error);
		throw new ApiError(500, "Failed to update schedule");
	}

	return data as FacilitySchedule;
}

export async function deleteSchedule(id: number): Promise<void> {
	const supabase = await createClient();
	const { error } = await supabase.from("facility_schedules").delete().eq("id", id);

	if (error) {
		console.error("Error deleting facility schedule:", error);
		throw new ApiError(500, "Failed to delete schedule");
	}
}

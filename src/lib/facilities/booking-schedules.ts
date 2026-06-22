import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { BookingSchedule } from "@/types/facilities";

export async function listSchedules(facilityId?: number): Promise<BookingSchedule[]> {
	const supabase = await createClient();

	let query = supabase.from("booking_schedules").select("*").order("day_of_week").order("hour");

	if (facilityId != null) query = query.eq("facility_id", facilityId);

	const { data, error } = await query;

	if (error) {
		console.error("Error listing booking schedules:", error);
		throw new ApiError(500, "Failed to load schedules");
	}

	return data ?? [];
}

export async function createSchedule(input: {
	facilityId: number;
	dayOfWeek: number;
	hour: number;
	priority?: number;
	reboksActivity?: string | null;
}): Promise<BookingSchedule> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("booking_schedules")
		.insert({
			facility_id: input.facilityId,
			day_of_week: input.dayOfWeek,
			hour: input.hour,
			priority: input.priority ?? 100,
			reboks_activity: input.reboksActivity ?? null,
		})
		.select("*")
		.single();

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "A schedule already exists for that facility, weekday and hour");
		}
		console.error("Error creating booking schedule:", error);
		throw new ApiError(500, "Failed to create schedule");
	}

	return data;
}

/** Patch a schedule's wave (priority) and/or REBOKS activity by id. */
export async function updateSchedule(
	id: number,
	patch: { priority?: number; reboks_activity?: string | null },
): Promise<BookingSchedule> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("booking_schedules")
		.update(patch)
		.eq("id", id)
		.select("*")
		.single();

	if (error) {
		console.error("Error updating booking schedule:", error);
		throw new ApiError(500, "Failed to update schedule");
	}

	return data;
}

export async function deleteSchedule(id: number): Promise<void> {
	const supabase = await createClient();
	const { error } = await supabase.from("booking_schedules").delete().eq("id", id);

	if (error) {
		console.error("Error deleting booking schedule:", error);
		throw new ApiError(500, "Failed to delete schedule");
	}
}

/** Delete the recipe matching (facility, weekday, hour), if any. Used by cancel-all-recurring. */
export async function deleteScheduleMatching(
	facilityId: number,
	dayOfWeek: number,
	hour: number,
): Promise<void> {
	const supabase = await createClient();
	const { error } = await supabase
		.from("booking_schedules")
		.delete()
		.eq("facility_id", facilityId)
		.eq("day_of_week", dayOfWeek)
		.eq("hour", hour);

	if (error) {
		console.error("Error deleting matching booking schedule:", error);
		throw new ApiError(500, "Failed to delete recurring schedule");
	}
}

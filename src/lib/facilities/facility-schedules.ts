import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { addDays, getSingaporeDateKey } from "@/lib/nus-academic-calendar";
import { isFacilityHidden, type ScheduleCell } from "@/lib/facilities/weekly-availability";
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

/** One schedule row, used to authorize type-scoped mutations. */
export async function getSchedule(id: number): Promise<FacilitySchedule | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("facility_schedules")
		.select("id, facility_id, day_of_week, hour, start_date, end_date")
		.eq("id", id)
		.maybeSingle();

	if (error) {
		console.error("Error loading facility schedule:", error);
		throw new ApiError(500, "Failed to load schedule");
	}

	return (data as FacilitySchedule | null) ?? null;
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

/**
 * Replace one facility's recurring weekly grid with a painted set of cells.
 *
 * Existing matching rows are retained. Missing rows are inserted before obsolete
 * rows are removed, so a failed insert cannot wipe the facility's current
 * availability. A venue hidden from Book stays hidden: its rows keep a past end
 * date, so saving hours does not reopen it by accident.
 */
export async function syncFacilityScheduleCells(
	facilityId: number,
	cells: ScheduleCell[],
): Promise<FacilitySchedule[]> {
	const supabase = await createClient();
	const current = await listSchedules(facilityId);
	const today = getSingaporeDateKey();
	const endDate = isFacilityHidden(current, today) ? addDays(today, -1) : null;
	const desiredKeys = new Set(cells.map((cell) => `${cell.day}:${cell.hour}`));
	const retainedIds: number[] = [];
	const obsoleteIds: number[] = [];
	const retainedKeys = new Set<string>();

	for (const schedule of current) {
		const key = `${schedule.day_of_week}:${schedule.hour}`;
		if (desiredKeys.has(key) && !retainedKeys.has(key)) {
			retainedKeys.add(key);
			retainedIds.push(schedule.id);
		} else {
			obsoleteIds.push(schedule.id);
		}
	}

	const missing = [...desiredKeys]
		.filter((key) => !retainedKeys.has(key))
		.map((key) => {
			const [day, hour] = key.split(":").map(Number);
			return {
				facility_id: facilityId,
				day_of_week: day,
				hour,
				start_date: null,
				end_date: endDate,
			};
		});

	if (missing.length > 0) {
		const { error } = await supabase.from("facility_schedules").insert(missing);
		if (error) {
			console.error("Error adding facility schedule grid rows:", error);
			throw new ApiError(500, "Failed to update facility availability");
		}
	}

	if (retainedIds.length > 0) {
		const { error } = await supabase
			.from("facility_schedules")
			.update({ start_date: null, end_date: endDate })
			.in("id", retainedIds);
		if (error) {
			console.error("Error normalizing facility schedule grid rows:", error);
			throw new ApiError(500, "Failed to update facility availability");
		}
	}

	if (obsoleteIds.length > 0) {
		const { error } = await supabase.from("facility_schedules").delete().in("id", obsoleteIds);
		if (error) {
			console.error("Error removing facility schedule grid rows:", error);
			throw new ApiError(500, "Failed to update facility availability");
		}
	}

	return listSchedules(facilityId);
}

/**
 * Show or hide a venue on Book without losing its hours.
 *
 * There is no hidden column, so hiding end-dates every row in the past: the
 * calendar stops offering them, and reopening clears the date. Existing claims
 * are left alone, as with any other end-dating.
 */
export async function setFacilityVisibility(
	facilityId: number,
	visible: boolean,
): Promise<FacilitySchedule[]> {
	const supabase = await createClient();
	const endDate = visible ? null : addDays(getSingaporeDateKey(), -1);

	const { error } = await supabase
		.from("facility_schedules")
		.update({ start_date: null, end_date: endDate })
		.eq("facility_id", facilityId);

	if (error) {
		console.error("Error updating facility visibility:", error);
		throw new ApiError(500, "Failed to update facility availability");
	}

	return listSchedules(facilityId);
}

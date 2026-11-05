import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { FacilitySlot, MAX_SLOT_WINDOW_DAYS, daysUntilBooking } from "@/types/facilities";

/**
 * Expand published schedules into dated slots across a window.
 *
 * This is the calendar query, and it replaces the old materialized
 * `facility_bookings` table entirely. Nothing stores a slot, so a schedule edit
 * can never leave a stale booking behind.
 *
 * Cost is linear in slots returned — a full weekly grid over a year is ~88k
 * rows and several hundred ms — so keep windows to a week or a month. The
 * function itself raises past 366 days.
 */
export async function getSlots(from: string, to: string): Promise<FacilitySlot[]> {
	const span = daysUntilBooking(to, new Date(from + "T00:00:00"));
	if (span < 0) {
		throw new ApiError(400, "Invalid slot window");
	}
	if (span > MAX_SLOT_WINDOW_DAYS) {
		throw new ApiError(400, `Slot window may not exceed ${MAX_SLOT_WINDOW_DAYS} days`);
	}

	const supabase = await createClient();

	const { data, error } = await supabase.rpc("facility_slots", { p_from: from, p_to: to });

	if (error) {
		console.error("Error fetching facility slots:", error);
		throw new ApiError(500, "Failed to load the facilities calendar");
	}

	return ((data ?? []) as FacilitySlot[]).map((slot) => ({
		...slot,
		// An unclaimed slot returns [], never null, but be defensive about it.
		claims: slot.claims ?? [],
	}));
}

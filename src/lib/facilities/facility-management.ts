import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { FacilityBooking, BookingType } from "@/types/facilities";

export interface CreateFacilitySlotInput {
	venue: string;
	sub_venue: string;
	activity: string;
	time_from: string;
	time_to: string;
	type: BookingType;
	remark: string | null;
	dates: string[];
}

export async function createFacilitySlots(
	input: CreateFacilitySlotInput,
): Promise<FacilityBooking[]> {
	const supabase = await createClient();

	const rows = input.dates.map((date) => ({
		booked_date: date,
		venue: input.venue,
		sub_venue: input.sub_venue,
		activity: input.activity,
		time_from: input.time_from,
		time_to: input.time_to,
		type: input.type,
		remark: input.remark,
	}));

	const { data, error } = await supabase.from("facilities").insert(rows).select("*");

	if (error) {
		console.error("Error creating facility slots:", error);
		throw new ApiError(500, "Failed to create facility slots");
	}

	return data ?? [];
}

export async function deleteFacilitySlot(slotId: number): Promise<void> {
	const supabase = await createClient();

	const { data: claims, error: claimsError } = await supabase
		.from("facility_claims")
		.select("id")
		.eq("facility_id", slotId)
		.not("status", "in", "('cancelled','yielded')");

	if (claimsError) {
		console.error("Error checking claims on slot:", claimsError);
		throw new ApiError(500, "Failed to check existing claims");
	}

	if (claims && claims.length > 0) {
		throw new ApiError(
			409,
			"Cannot delete slot with active claims. Cancel or resolve claims first.",
		);
	}

	const { error } = await supabase.from("facilities").delete().eq("id", slotId);

	if (error) {
		console.error("Error deleting facility slot:", error);
		throw new ApiError(500, "Failed to delete facility slot");
	}
}

export async function deleteFacilitySlotsBatch(
	slotIds: number[],
): Promise<{ deleted: number; skipped: number }> {
	const supabase = await createClient();

	const { data: claimedSlots, error: claimsError } = await supabase
		.from("facility_claims")
		.select("facility_id")
		.in("facility_id", slotIds)
		.not("status", "in", "('cancelled','yielded')");

	if (claimsError) {
		console.error("Error checking claims:", claimsError);
		throw new ApiError(500, "Failed to check existing claims");
	}

	const claimedIds = new Set((claimedSlots ?? []).map((c) => c.facility_id));
	const deletableIds = slotIds.filter((id) => !claimedIds.has(id));

	if (deletableIds.length === 0) {
		return { deleted: 0, skipped: slotIds.length };
	}

	const { error } = await supabase.from("facilities").delete().in("id", deletableIds);

	if (error) {
		console.error("Error batch-deleting facility slots:", error);
		throw new ApiError(500, "Failed to delete facility slots");
	}

	return { deleted: deletableIds.length, skipped: claimedIds.size };
}

export async function getManagedSlots(
	startDate: string,
	endDate: string,
): Promise<(FacilityBooking & { claim_count: number })[]> {
	const supabase = await createClient();

	const { data: slots, error } = await supabase
		.from("facilities")
		.select("*")
		.gte("booked_date", startDate)
		.lte("booked_date", endDate)
		.order("booked_date")
		.order("time_from");

	if (error) {
		console.error("Error fetching managed slots:", error);
		throw new ApiError(500, "Failed to load facility slots");
	}

	if (!slots || slots.length === 0) return [];

	const slotIds = slots.map((s) => s.id);
	const { data: claims } = await supabase
		.from("facility_claims")
		.select("facility_id")
		.in("facility_id", slotIds)
		.not("status", "in", "('cancelled','yielded')");

	const countMap = new Map<number, number>();
	for (const c of claims ?? []) {
		countMap.set(c.facility_id, (countMap.get(c.facility_id) ?? 0) + 1);
	}

	return slots.map((slot) => ({
		...slot,
		claim_count: countMap.get(slot.id) ?? 0,
	}));
}

export function expandRecurringDates(
	startDate: string,
	endDate: string,
	daysOfWeek: number[],
): string[] {
	const dates: string[] = [];
	const start = new Date(startDate + "T00:00:00");
	const end = new Date(endDate + "T00:00:00");

	for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
		if (daysOfWeek.includes(d.getDay())) {
			dates.push(d.toISOString().slice(0, 10));
		}
	}

	return dates;
}

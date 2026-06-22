import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import {
	BookingWithClaims,
	FacilityBooking,
	FacilityClaim,
	FacilityType,
	ClaimStatus,
	BookingStatus,
	weekdayOf,
} from "@/types/facilities";

const ACTIVE_CLAIM_FILTER = "('rejected','cancelled')";

interface FacilityJoin {
	venue: string;
	sub_venue: string;
	type: FacilityType;
}

function flattenBooking(row: {
	id: number;
	facility_id: number;
	booked_date: string;
	hour: number;
	status: BookingStatus;
	facilities: FacilityJoin | FacilityJoin[] | null;
}): FacilityBooking {
	const facility = Array.isArray(row.facilities) ? row.facilities[0] : row.facilities;
	return {
		id: row.id,
		facility_id: row.facility_id,
		venue: facility?.venue ?? "",
		sub_venue: facility?.sub_venue ?? "",
		type: facility?.type ?? "external",
		booked_date: row.booked_date,
		hour: row.hour,
		status: row.status,
	};
}

/**
 * Bookings in a date range, flattened with facility + active claims, with a derived
 * `recurring` flag (matches a booking_schedules recipe). `userCcaIds` marks the caller's claim.
 */
export async function listBookings(opts: {
	startDate: string;
	endDate: string;
	type?: FacilityType;
	userCcaIds?: number[];
}): Promise<BookingWithClaims[]> {
	const supabase = await createClient();

	let query = supabase
		.from("facility_bookings")
		.select("*, facilities!inner(venue, sub_venue, type)")
		.gte("booked_date", opts.startDate)
		.lte("booked_date", opts.endDate)
		.order("booked_date")
		.order("hour");

	if (opts.type) query = query.eq("facilities.type", opts.type);

	const { data: rows, error } = await query;

	if (error) {
		console.error("Error listing facility bookings:", error);
		throw new ApiError(500, "Failed to load bookings");
	}
	if (!rows || rows.length === 0) return [];

	const bookings = rows.map(flattenBooking);
	const bookingIds = bookings.map((b) => b.id);

	// Active claims for these bookings.
	const { data: claimRows, error: claimsError } = await supabase
		.from("facility_claims")
		.select("*, ccas(name)")
		.in("booking_id", bookingIds)
		.not("status", "in", ACTIVE_CLAIM_FILTER);

	if (claimsError) {
		console.error("Error fetching claims (non-fatal):", claimsError);
	}

	const claimsByBooking = new Map<number, FacilityClaim[]>();
	for (const row of (claimsError ? [] : claimRows) ?? []) {
		const claim: FacilityClaim = {
			id: row.id,
			booking_id: row.booking_id,
			cca_id: row.cca_id,
			cca_name: (row.ccas as { name: string } | null)?.name ?? "Unknown CCA",
			status: row.status as ClaimStatus,
			claimed_by: row.claimed_by,
			claimed_at: row.claimed_at,
			resolved_at: row.resolved_at,
			resolved_by: row.resolved_by,
		};
		const list = claimsByBooking.get(row.booking_id) ?? [];
		list.push(claim);
		claimsByBooking.set(row.booking_id, list);
	}

	// Recurrence: which (facility, weekday, hour) tuples have a schedule recipe.
	const facilityIds = [...new Set(bookings.map((b) => b.facility_id))];
	const { data: schedules } = await supabase
		.from("booking_schedules")
		.select("facility_id, day_of_week, hour")
		.in("facility_id", facilityIds);

	const scheduleKeys = new Set(
		(schedules ?? []).map((s) => `${s.facility_id}|${s.day_of_week}|${s.hour}`),
	);

	const userCcaIds = opts.userCcaIds ?? [];

	return bookings.map((b) => {
		const claims = claimsByBooking.get(b.id) ?? [];
		const userClaim = claims.find((c) => userCcaIds.includes(c.cca_id)) ?? null;
		const recurring = scheduleKeys.has(`${b.facility_id}|${weekdayOf(b.booked_date)}|${b.hour}`);
		return { ...b, claims, user_cca_claim: userClaim, recurring };
	});
}

export async function createBooking(
	facilityId: number,
	bookedDate: string,
	hour: number,
): Promise<FacilityBooking> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("facility_bookings")
		.insert({ facility_id: facilityId, booked_date: bookedDate, hour })
		.select("*, facilities(venue, sub_venue, type)")
		.single();

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "A booking already exists for that facility, date and hour");
		}
		console.error("Error creating booking:", error);
		throw new ApiError(500, "Failed to create booking");
	}

	return flattenBooking(data);
}

/** Local-safe YYYY-MM-DD for a Date (avoids the UTC shift of toISOString). */
function toLocalDateString(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** All YYYY-MM-DD dates in [start, end] whose weekday === dayOfWeek. */
export function expandWeekly(startDate: string, endDate: string, dayOfWeek: number): string[] {
	const dates: string[] = [];
	const start = new Date(startDate + "T00:00:00");
	const end = new Date(endDate + "T00:00:00");
	for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
		if (d.getDay() === dayOfWeek) dates.push(toLocalDateString(d));
	}
	return dates;
}

/**
 * Materialise `facility_bookings` for NON-REBOKS schedules across [start, end].
 * REBOKS rows are owned by the external bot and never created here. Idempotent
 * (upsert ignoreDuplicates). MUST run under a JCRC session — RLS gates
 * facility_bookings writes to JCRC, so resident reads cannot trigger this.
 */
export async function ensureBookingsForWindow(
	start: string,
	end: string,
): Promise<{ created: number }> {
	const supabase = await createClient();

	const { data: schedules, error } = await supabase
		.from("booking_schedules")
		.select("facility_id, day_of_week, hour, facilities!inner(type)")
		.neq("facilities.type", "reboks");

	if (error) {
		console.error("Error loading non-reboks schedules:", error);
		throw new ApiError(500, "Failed to load schedules");
	}
	if (!schedules || schedules.length === 0) return { created: 0 };

	const rows: { facility_id: number; booked_date: string; hour: number }[] = [];
	for (const s of schedules as { facility_id: number; day_of_week: number; hour: number }[]) {
		for (const booked_date of expandWeekly(start, end, s.day_of_week)) {
			rows.push({ facility_id: s.facility_id, booked_date, hour: s.hour });
		}
	}
	if (rows.length === 0) return { created: 0 };

	const { data, error: upsertError } = await supabase
		.from("facility_bookings")
		.upsert(rows, { onConflict: "facility_id,booked_date,hour", ignoreDuplicates: true })
		.select("id");

	if (upsertError) {
		console.error("Error materialising non-reboks bookings:", upsertError);
		throw new ApiError(500, "Failed to materialise bookings");
	}

	return { created: data?.length ?? 0 };
}

/**
 * Create a recurring recipe: insert the booking_schedules row, then materialize the
 * facility_bookings occurrences in range (manual types — Sheares is bot-driven).
 * Returns the number of occurrences created.
 */
export async function createRecurringBookings(input: {
	facilityId: number;
	dayOfWeek: number;
	hour: number;
	startDate: string;
	endDate: string;
}): Promise<{ created: number }> {
	const supabase = await createClient();

	const dates = expandWeekly(input.startDate, input.endDate, input.dayOfWeek);
	if (dates.length === 0) {
		throw new ApiError(400, "No dates match that weekday in the selected range");
	}
	if (dates.length > 100) {
		throw new ApiError(400, "Too many occurrences (max 100). Shorten the date range.");
	}

	// Recipe first (idempotent on conflict).
	const { error: schedError } = await supabase
		.from("booking_schedules")
		.upsert(
			{ facility_id: input.facilityId, day_of_week: input.dayOfWeek, hour: input.hour },
			{ onConflict: "facility_id,day_of_week,hour", ignoreDuplicates: true },
		);

	if (schedError) {
		console.error("Error creating recurring schedule:", schedError);
		throw new ApiError(500, "Failed to create recurring schedule");
	}

	// Occurrences (skip any that already exist).
	const rows = dates.map((booked_date) => ({
		facility_id: input.facilityId,
		booked_date,
		hour: input.hour,
	}));

	const { data, error } = await supabase
		.from("facility_bookings")
		.upsert(rows, { onConflict: "facility_id,booked_date,hour", ignoreDuplicates: true })
		.select("id");

	if (error) {
		console.error("Error creating recurring bookings:", error);
		throw new ApiError(500, "Failed to create recurring bookings");
	}

	return { created: data?.length ?? 0 };
}

/** Cancel one occurrence = delete the booking row (claims cascade in the DB). */
export async function deleteBooking(id: number): Promise<void> {
	const supabase = await createClient();
	const { error } = await supabase.from("facility_bookings").delete().eq("id", id);

	if (error) {
		console.error("Error deleting booking:", error);
		throw new ApiError(500, "Failed to cancel booking");
	}
}

/**
 * Cancel all recurring = delete the schedule recipe + future occurrences matching
 * (facility, weekday, hour). Past occurrences are left as history.
 */
export async function deleteBookingSeries(input: {
	facilityId: number;
	dayOfWeek: number;
	hour: number;
	fromDate: string;
}): Promise<{ deleted: number }> {
	const supabase = await createClient();

	// Drop the recipe so the bot/app stops generating.
	const { error: schedError } = await supabase
		.from("booking_schedules")
		.delete()
		.eq("facility_id", input.facilityId)
		.eq("day_of_week", input.dayOfWeek)
		.eq("hour", input.hour);

	if (schedError) {
		console.error("Error deleting series schedule:", schedError);
		throw new ApiError(500, "Failed to cancel recurring schedule");
	}

	// Future occurrences for this facility/hour. Weekday is filtered client-side after fetch
	// since Postgres weekday extraction isn't available through PostgREST filters here.
	const { data: future, error: fetchError } = await supabase
		.from("facility_bookings")
		.select("id, booked_date")
		.eq("facility_id", input.facilityId)
		.eq("hour", input.hour)
		.gte("booked_date", input.fromDate);

	if (fetchError) {
		console.error("Error fetching future occurrences:", fetchError);
		throw new ApiError(500, "Failed to load recurring occurrences");
	}

	const ids = (future ?? [])
		.filter((b) => weekdayOf(b.booked_date) === input.dayOfWeek)
		.map((b) => b.id);

	if (ids.length === 0) return { deleted: 0 };

	const { error: delError } = await supabase.from("facility_bookings").delete().in("id", ids);

	if (delError) {
		console.error("Error deleting future occurrences:", delError);
		throw new ApiError(500, "Failed to cancel recurring bookings");
	}

	return { deleted: ids.length };
}

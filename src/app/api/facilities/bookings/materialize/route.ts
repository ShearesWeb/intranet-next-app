import { requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { ensureBookingsForWindow } from "@/lib/facilities/facility-bookings";

export const dynamic = "force-dynamic";

const HORIZON_DAYS = 56; // 8 weeks

/**
 * Materialise NON-REBOKS bookable slots for the forward window. JCRC-only: RLS
 * gates facility_bookings writes to JCRC, so this can't run on a resident read.
 * Idempotent — safe to call on every Admin → Schedules visit.
 */
export async function POST() {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const today = new Date();
		const end = new Date(today);
		end.setDate(end.getDate() + HORIZON_DAYS);
		const fmt = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

		const result = await ensureBookingsForWindow(fmt(today), fmt(end));
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

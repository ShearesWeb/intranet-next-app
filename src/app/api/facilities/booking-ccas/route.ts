import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getBookingCcas } from "@/lib/facilities/booking-ccas";

export const dynamic = "force-dynamic";

/** The CCAs the caller may request facilities under. */
export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		const user = await requireAuth();
		return apiOk(await getBookingCcas(user));
	} catch (e) {
		return handleApiError(e);
	}
}

import { requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { deleteBooking } from "@/lib/facilities/facility-bookings";

export const dynamic = "force-dynamic";

/** Cancel this occurrence — delete the one booking row (claims cascade). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { id } = await params;
		await deleteBooking(Number(id));
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

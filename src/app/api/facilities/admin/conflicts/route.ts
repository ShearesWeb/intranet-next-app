import { requireJcrcOrAdminAccess } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getAllConflicts } from "@/lib/facilities/facility-conflicts";

export const dynamic = "force-dynamic";

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcOrAdminAccess();
		const conflicts = await getAllConflicts();
		return apiOk(conflicts);
	} catch (e) {
		return handleApiError(e);
	}
}

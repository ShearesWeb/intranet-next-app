import { apiOk, handleApiError } from "@/lib/api/response";
import { requireJcrcAccess } from "@/lib/api/auth";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getApprovalsIndex } from "@/lib/holiday-subsidy/approval-service";

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const result = await getApprovalsIndex();
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

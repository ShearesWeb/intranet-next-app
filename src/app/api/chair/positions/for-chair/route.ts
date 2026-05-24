import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getPositionsForChair } from "@/lib/cca/position-service";

export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const result = await getPositionsForChair();
		return apiOk(result, 200);
	} catch (e) {
		return handleApiError(e);
	}
}

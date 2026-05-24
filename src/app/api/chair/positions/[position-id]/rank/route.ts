import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { savePositionRankings } from "@/lib/cca/position-service";

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ "position-id": string }> },
) {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const { "position-id": positionId } = await params;
		const body = await req.json();
		const result = await savePositionRankings(positionId, body);
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { addApplicant, removeApplicant } from "@/features/cca/services/position-service";

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ "position-id": string }> },
) {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const { "position-id": positionId } = await params;
		const body = await req.json();
		const result = await addApplicant(positionId, body);
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function DELETE(
	req: Request,
	{ params }: { params: Promise<{ "position-id": string }> },
) {
	const disabledResponse = getCoreServiceDisabledApiResponse("ccaApplications");
	if (disabledResponse) return disabledResponse;

	try {
		const { "position-id": positionId } = await params;
		const body = await req.json();
		await removeApplicant(positionId, body);
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

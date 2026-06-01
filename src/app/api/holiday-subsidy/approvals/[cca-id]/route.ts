import { apiOk, handleApiError } from "@/lib/api/response";
import { requireJcrcAccess } from "@/lib/api/auth";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { ApiError } from "@/lib/api/errors";
import { getApprovalDetails, batchApprove } from "@/lib/holiday-subsidy/approval-service";

type Params = {
	params: Promise<{ "cca-id": string }>;
};

function parseCcaId(raw: string): number {
	const ccaId = Number(raw);
	if (!ccaId || isNaN(ccaId)) throw new ApiError(400, "Invalid CCA");
	return ccaId;
}

export async function GET(_request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const ccaId = parseCcaId((await params)["cca-id"]);
		const result = await getApprovalDetails(ccaId);
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function PATCH(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const ccaId = parseCcaId((await params)["cca-id"]);

		const body = await request.json();
		const updates = body?.updates || [];

		const result = await batchApprove(ccaId, updates);
		return apiOk(result);
	} catch (e) {
		// batchApprove attaches a `failures` array to the ApiError for
		// per-row detail. Surface it alongside the error message.
		if (e instanceof ApiError && "failures" in e) {
			const { failures } = e as ApiError & { failures: unknown[] };
			return Response.json({ data: null, error: e.message, failures }, { status: e.statusCode });
		}
		return handleApiError(e);
	}
}

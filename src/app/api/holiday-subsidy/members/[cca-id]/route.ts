import { apiOk, handleApiError } from "@/lib/api/response";
import { requireChairAccess } from "@/lib/api/auth";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { ApiError } from "@/lib/api/errors";
import {
	getMemberAssignments,
	saveMemberAssignments,
} from "@/lib/holiday-subsidy/member-service";

type Params = {
	params: Promise<{ "cca-id": string }>;
};

function parseCcaId(raw: string): number {
	const ccaId = parseInt(raw, 10);
	if (isNaN(ccaId)) throw new ApiError(400, "Invalid CCA ID");
	return ccaId;
}

export async function GET(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		const ccaId = parseCcaId((await params)["cca-id"]);
		await requireChairAccess(ccaId);

		const { searchParams } = new URL(request.url);
		const day = searchParams.get("day");
		if (!day) throw new ApiError(400, "day query param required");

		const result = await getMemberAssignments(ccaId, day);
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		const ccaId = parseCcaId((await params)["cca-id"]);
		await requireChairAccess(ccaId);

		const body = await request.json();
		const day = body?.day;
		const declarations = body?.declarations || [];
		const deletions = body?.deletions || [];

		if (!day) throw new ApiError(400, "day is required");
		if (!Array.isArray(declarations) || !Array.isArray(deletions)) {
			throw new ApiError(400, "Invalid payload");
		}

		const result = await saveMemberAssignments(ccaId, day, declarations, deletions);
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

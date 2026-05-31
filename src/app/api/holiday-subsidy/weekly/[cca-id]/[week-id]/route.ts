import { NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireChairAccess } from "@/lib/api/auth";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { ApiError } from "@/lib/api/errors";
import { getWeeklyCommitments, saveWeeklyCommitments } from "@/lib/holiday-subsidy/weekly-service";

type Params = {
	params: Promise<{ "cca-id": string; "week-id": string }>;
};

function parseParams(raw: { "cca-id": string; "week-id": string }) {
	const ccaId = parseInt(raw["cca-id"], 10);
	const weekId = parseInt(raw["week-id"], 10);
	if (isNaN(ccaId)) throw new ApiError(400, "Invalid CCA ID");
	if (isNaN(weekId)) throw new ApiError(400, "Invalid week ID");
	return { ccaId, weekId };
}

export async function GET(_request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		const { ccaId, weekId } = parseParams(await params);
		await requireChairAccess(ccaId);
		const result = await getWeeklyCommitments(ccaId, weekId);
		return NextResponse.json(
			{ data: result, error: null },
			{ headers: { "Cache-Control": "no-store, private" } },
		);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		const { ccaId, weekId } = parseParams(await params);
		await requireChairAccess(ccaId);

		const body = await request.json();
		const declarations = body?.declarations || [];
		const deletions = body?.deletions || [];

		if (!Array.isArray(declarations) || !Array.isArray(deletions)) {
			throw new ApiError(400, "Invalid payload");
		}

		const result = await saveWeeklyCommitments(ccaId, weekId, declarations, deletions);
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

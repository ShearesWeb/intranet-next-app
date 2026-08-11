import { NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireJcrcAccess } from "@/lib/api/auth";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { ApiError } from "@/lib/api/errors";
import { getWeeklyApprovals, batchApproveWeekly } from "@/lib/holiday-subsidy/weekly-service";

type Params = {
	params: Promise<{ "cca-id": string; "week-id": string }>;
};

function parseParams(raw: { "cca-id": string; "week-id": string }) {
	const ccaId = Number(raw["cca-id"]);
	const weekId = Number(raw["week-id"]);
	if (isNaN(ccaId) || isNaN(weekId)) throw new ApiError(400, "Invalid CCA ID or Week ID");
	return { ccaId, weekId };
}

export async function GET(_request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { ccaId, weekId } = parseParams(await params);
		const result = await getWeeklyApprovals(ccaId, weekId);
		return NextResponse.json(
			{ data: result, error: null },
			{ headers: { "Cache-Control": "no-store, private" } },
		);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function PATCH(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		parseParams(await params); // validate params

		const body = await request.json();
		const updates = body?.updates || [];

		const result = await batchApproveWeekly(updates);
		return apiOk(result);
	} catch (e) {
		if (e instanceof ApiError && "failures" in e) {
			const { failures } = e as ApiError & { failures: unknown[] };
			return Response.json({ data: null, error: e.message, failures }, { status: e.statusCode });
		}
		return handleApiError(e);
	}
}

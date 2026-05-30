import { apiOk, handleApiError } from "@/lib/api/response";
import { requireChairAccess } from "@/lib/api/auth";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { ApiError } from "@/lib/api/errors";
import {
	getDeclarations,
	upsertDeclaration,
	deleteDeclaration,
} from "@/lib/holiday-subsidy/declaration-service";

type Params = {
	params: Promise<{ "cca-id": string }>;
};

function parseCcaId(raw: string): number {
	const ccaId = parseInt(raw, 10);
	if (isNaN(ccaId)) throw new ApiError(400, "Invalid CCA ID");
	return ccaId;
}

export async function GET(_request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		const ccaId = parseCcaId((await params)["cca-id"]);
		await requireChairAccess(ccaId);
		const result = await getDeclarations(ccaId);
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
		const { positionId, weekId, day, hours, justification } = body || {};

		if (!positionId || (!weekId && !day) || hours === undefined || hours === null) {
			throw new ApiError(400, "Position, day (or week), and hours are required");
		}

		const result = await upsertDeclaration({
			positionId: Number(positionId),
			weekId: weekId ? Number(weekId) : undefined,
			day: day ?? undefined,
			hours: Number(hours),
			justification: justification ?? null,
		});
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function PATCH(request: Request, { params }: Params) {
	// upsert_subsidy handles both INSERT and UPDATE branches (and the
	// rejected->pending resubmit). PATCH is functionally identical to POST.
	return POST(request, { params });
}

export async function DELETE(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");
	if (disabledResponse) return disabledResponse;

	try {
		const ccaId = parseCcaId((await params)["cca-id"]);
		await requireChairAccess(ccaId);

		const body = await request.json();
		const { subsidyId } = body || {};

		if (!subsidyId) {
			throw new ApiError(400, "Subsidy ID is required");
		}

		const result = await deleteDeclaration({ ccaId, subsidyId });
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

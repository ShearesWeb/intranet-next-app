import { requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { deleteFacilitySlot } from "@/lib/facilities/facility-management";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { id } = await params;
		const slotId = parseInt(id, 10);

		if (isNaN(slotId)) {
			return apiOk(null, 400);
		}

		await deleteFacilitySlot(slotId);
		return apiOk({ deleted: true });
	} catch (e) {
		return handleApiError(e);
	}
}

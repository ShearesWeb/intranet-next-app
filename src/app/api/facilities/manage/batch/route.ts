import { requireJcrcOrAdminAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { deleteFacilitySlotsBatch } from "@/lib/facilities/facility-management";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
  if (disabledResponse) return disabledResponse;

  try {
    await requireJcrcOrAdminAccess();
    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return apiError("ids array is required", 400);
    }

    if (ids.length > 100) {
      return apiError("Max 100 slots per batch delete", 400);
    }

    const result = await deleteFacilitySlotsBatch(ids);
    return apiOk(result);
  } catch (e) {
    return handleApiError(e);
  }
}

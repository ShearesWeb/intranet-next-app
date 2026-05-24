import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getConflictsForCca } from "@/lib/facilities/facility-conflicts";
import { getChairCcaIds } from "@/lib/facilities/facility-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireAuth();
    const ccaIds = getChairCcaIds(user);

    if (ccaIds.length === 0) return apiOk([]);

    const conflicts = await getConflictsForCca(ccaIds);
    return apiOk(conflicts);
  } catch (e) {
    return handleApiError(e);
  }
}

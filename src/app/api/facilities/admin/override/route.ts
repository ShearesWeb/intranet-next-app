import { requireJcrcOrAdminAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { overrideConflict } from "@/lib/facilities/facility-conflicts";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
  if (disabledResponse) return disabledResponse;

  try {
    await requireJcrcOrAdminAccess();
    const body = await req.json();
    const { facility_id, winning_cca_id } = body;

    if (!facility_id || !winning_cca_id) {
      return apiError("Missing required fields: facility_id, winning_cca_id", 400);
    }

    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return apiError("Auth session not found", 401);

    await overrideConflict(facility_id, winning_cca_id, authUser.id);
    return apiOk({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}

import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { updateClaimStatus } from "@/lib/facilities/facility-claims";
import { isChairOfCca, canManageFacilities } from "@/lib/facilities/facility-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireAuth();
    const { id } = await params;
    const claimId = Number(id);
    const body = await req.json();
    const { status } = body;

    if (!status || !["yielded", "cancelled"].includes(status)) {
      return apiError("Status must be 'yielded' or 'cancelled'", 400);
    }

    const supabase = await createClient();
    const { data: claim } = await supabase
      .from("facility_claims")
      .select("cca_id")
      .eq("id", claimId)
      .single();

    if (!claim) return apiError("Claim not found", 404);

    if (!isChairOfCca(user, claim.cca_id) && !canManageFacilities(user)) {
      return apiError("Not authorized to modify this claim", 403);
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return apiError("Auth session not found", 401);

    await updateClaimStatus(claimId, status, authUser.id);
    return apiOk({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}

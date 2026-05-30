import { requireAuth } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getClaimsForCca, createClaim } from "@/lib/facilities/facility-claims";
import { isChairOfCca, getChairCcaIds } from "@/lib/facilities/facility-access";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireAuth();
    const ccaId = req.nextUrl.searchParams.get("ccaId");

    if (!ccaId) {
      const chairCcaIds = getChairCcaIds(user);
      if (chairCcaIds.length === 0) return apiOk([]);
      const claims = await getClaimsForCca(chairCcaIds[0]);
      return apiOk(claims);
    }

    if (!isChairOfCca(user, Number(ccaId))) {
      return apiError("Not authorized to view this CCA's claims", 403);
    }

    const claims = await getClaimsForCca(Number(ccaId));
    return apiOk(claims);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireAuth();
    const body = await req.json();
    const { facility_id, cca_id, activity } = body;

    if (!facility_id || !cca_id || !activity) {
      return apiError("Missing required fields: facility_id, cca_id, activity", 400);
    }

    if (!isChairOfCca(user, cca_id)) {
      return apiError("Not authorized to claim for this CCA", 403);
    }

    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return apiError("Auth session not found", 401);

    const claim = await createClaim(facility_id, cca_id, activity, authUser.id, null);
    return apiOk(claim, 201);
  } catch (e) {
    return handleApiError(e);
  }
}

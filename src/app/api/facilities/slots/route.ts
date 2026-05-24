import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getSlotsWithClaims } from "@/lib/facilities/facility-claims";
import { getChairCcaIds } from "@/lib/facilities/facility-access";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireAuth();
    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    if (!startDate || !endDate) {
      return apiOk([]);
    }

    const userCcaIds = getChairCcaIds(user);
    const slots = await getSlotsWithClaims(startDate, endDate, userCcaIds);
    return apiOk(slots);
  } catch (e) {
    return handleApiError(e);
  }
}

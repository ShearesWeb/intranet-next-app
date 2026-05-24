import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { FacilityClaim, FacilitySlotWithClaims, ClaimStatus } from "@/types/facilities";

export async function getSlotsWithClaims(
  startDate: string,
  endDate: string,
  userCcaIds: number[],
): Promise<FacilitySlotWithClaims[]> {
  const supabase = await createClient();

  const { data: slots, error: slotsError } = await supabase
    .from("facilities")
    .select("*")
    .gte("booked_date", startDate)
    .lte("booked_date", endDate)
    .order("booked_date")
    .order("time_from");

  if (slotsError) {
    console.error("Error fetching facility slots:", slotsError);
    throw new ApiError(500, "Failed to load facility slots");
  }

  if (!slots || slots.length === 0) return [];

  const slotIds = slots.map((s) => s.id);

  const { data: claims, error: claimsError } = await supabase
    .from("facility_claims")
    .select("*, ccas(name)")
    .in("facility_id", slotIds)
    .not("status", "in", "('cancelled','yielded')");

  if (claimsError) {
    console.error("Error fetching facility claims:", claimsError);
    throw new ApiError(500, "Failed to load facility claims");
  }

  const claimsByFacility = new Map<number, FacilityClaim[]>();
  for (const row of claims ?? []) {
    const claim: FacilityClaim = {
      id: row.id,
      facility_id: row.facility_id,
      cca_id: row.cca_id,
      cca_name: (row.ccas as { name: string })?.name ?? "Unknown CCA",
      activity: row.activity,
      status: row.status as ClaimStatus,
      recurrence_group: row.recurrence_group,
      claimed_by: row.claimed_by,
      claimed_at: row.claimed_at,
      resolved_at: row.resolved_at,
      resolved_by: row.resolved_by,
    };
    const list = claimsByFacility.get(row.facility_id) ?? [];
    list.push(claim);
    claimsByFacility.set(row.facility_id, list);
  }

  return slots.map((slot) => {
    const slotClaims = claimsByFacility.get(slot.id) ?? [];
    const userClaim = slotClaims.find((c) => userCcaIds.includes(c.cca_id)) ?? null;
    return {
      ...slot,
      claims: slotClaims,
      user_cca_claim: userClaim,
    };
  });
}

export async function getClaimsForCca(ccaId: number): Promise<FacilityClaim[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facility_claims")
    .select("*, ccas(name), facilities(booked_date, venue, sub_venue, time_from, time_to, type)")
    .eq("cca_id", ccaId)
    .order("claimed_at", { ascending: false });

  if (error) {
    console.error("Error fetching CCA claims:", error);
    throw new ApiError(500, "Failed to load your CCA's claims");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    facility_id: row.facility_id,
    cca_id: row.cca_id,
    cca_name: (row.ccas as { name: string })?.name ?? "Unknown CCA",
    activity: row.activity,
    status: row.status as ClaimStatus,
    recurrence_group: row.recurrence_group,
    claimed_by: row.claimed_by,
    claimed_at: row.claimed_at,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    facility: row.facilities,
  }));
}

export async function createClaim(
  facilityId: number,
  ccaId: number,
  activity: string,
  userId: string,
  recurrenceGroup: string | null,
): Promise<FacilityClaim> {
  const supabase = await createClient();

  const { data: existingClaims, error: existError } = await supabase
    .from("facility_claims")
    .select("id, status")
    .eq("facility_id", facilityId)
    .not("status", "in", "('cancelled','yielded')");

  if (existError) {
    console.error("Error checking existing claims:", existError);
    throw new ApiError(500, "Failed to check existing claims");
  }

  const hasConflict = (existingClaims ?? []).length > 0;
  const newStatus: ClaimStatus = hasConflict ? "conflicted" : "approved";

  if (hasConflict) {
    const activeClaimIds = (existingClaims ?? [])
      .filter((c) => c.status !== "conflicted")
      .map((c) => c.id);

    if (activeClaimIds.length > 0) {
      const { error: updateError } = await supabase
        .from("facility_claims")
        .update({ status: "conflicted" })
        .in("id", activeClaimIds);

      if (updateError) {
        console.error("Error updating existing claims to conflicted:", updateError);
        throw new ApiError(500, "Failed to update existing claims");
      }
    }
  }

  const { data: newClaim, error: insertError } = await supabase
    .from("facility_claims")
    .insert({
      facility_id: facilityId,
      cca_id: ccaId,
      activity,
      status: newStatus,
      recurrence_group: recurrenceGroup,
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
    })
    .select("*, ccas(name)")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new ApiError(409, "Your CCA has already claimed this slot");
    }
    console.error("Error creating claim:", insertError);
    throw new ApiError(500, "Failed to create claim");
  }

  return {
    id: newClaim.id,
    facility_id: newClaim.facility_id,
    cca_id: newClaim.cca_id,
    cca_name: (newClaim.ccas as { name: string })?.name ?? "Unknown CCA",
    activity: newClaim.activity,
    status: newClaim.status as ClaimStatus,
    recurrence_group: newClaim.recurrence_group,
    claimed_by: newClaim.claimed_by,
    claimed_at: newClaim.claimed_at,
    resolved_at: newClaim.resolved_at,
    resolved_by: newClaim.resolved_by,
  };
}

export async function updateClaimStatus(
  claimId: number,
  newStatus: "yielded" | "cancelled",
  userId: string,
): Promise<void> {
  const supabase = await createClient();

  const { data: claim, error: fetchError } = await supabase
    .from("facility_claims")
    .select("id, facility_id, status")
    .eq("id", claimId)
    .single();

  if (fetchError || !claim) {
    throw new ApiError(404, "Claim not found");
  }

  if (claim.status === "yielded" || claim.status === "cancelled") {
    throw new ApiError(400, "Claim is already resolved");
  }

  const { error: updateError } = await supabase
    .from("facility_claims")
    .update({
      status: newStatus,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq("id", claimId);

  if (updateError) {
    console.error("Error updating claim status:", updateError);
    throw new ApiError(500, "Failed to update claim");
  }

  // Auto-approve: if only one conflicted claim remains, approve it
  if (newStatus === "yielded") {
    const { data: remaining, error: remainError } = await supabase
      .from("facility_claims")
      .select("id")
      .eq("facility_id", claim.facility_id)
      .eq("status", "conflicted");

    if (!remainError && remaining && remaining.length === 1) {
      await supabase
        .from("facility_claims")
        .update({
          status: "approved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", remaining[0].id);
    }
  }
}

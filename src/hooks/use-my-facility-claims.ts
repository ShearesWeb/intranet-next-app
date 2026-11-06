"use client";

import { useApiQuery } from "@/hooks/use-api-query";
import { type GridClaim } from "@/lib/facilities/booking-grid";
import type { ClaimWithFacility } from "@/lib/facilities/facility-claims";

export interface MyClaim extends GridClaim {
	venue: string;
	sub_venue: string;
}

const NO_CLAIMS: MyClaim[] = [];

function toMyClaims(json: unknown): MyClaim[] {
	const rows = (json as { data: ClaimWithFacility[] | null }).data ?? [];
	return rows.map((row) => ({
		claim_id: row.id,
		facility_id: row.facility_id,
		date: row.date,
		hour: row.hour,
		cca_id: row.cca_id,
		cca_name: row.cca_name,
		status: row.status,
		venue: row.venue,
		sub_venue: row.sub_venue,
	}));
}

/**
 * Every claim of the CCAs the user books for, including declined ones, which the
 * calendar's slots may not carry. `loading` covers the first fetch only, so a
 * refetch after a change does not blank the page.
 */
export function useMyFacilityClaims(enabled: boolean) {
	const { data, hasLoaded, refetch } = useApiQuery<MyClaim[]>("/api/facilities/claims", {
		enabled,
		initialData: NO_CLAIMS,
		select: toMyClaims,
		toastOnError: true,
		errorMessage: "Failed to load bookings",
	});

	return { claims: data ?? NO_CLAIMS, loading: !hasLoaded, refetch };
}

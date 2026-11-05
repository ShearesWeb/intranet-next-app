"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isBookableFacilityType } from "@/lib/facilities/bookable-types";
import { type GridClaim } from "@/lib/facilities/booking-grid";
import { type ClaimStatus, type FacilityType } from "@/types/facilities";

export interface MyClaim extends GridClaim {
	venue: string;
	sub_venue: string;
}

interface ClaimRow {
	id: number;
	facility_id: number;
	date: string;
	hour: number;
	cca_id: number;
	cca_name: string;
	status: ClaimStatus;
	venue: string;
	sub_venue: string;
	facility_type: FacilityType;
}

/**
 * Every claim of the CCAs the user chairs, including declined ones, which the
 * calendar's slots may not carry. `loading` covers the first fetch only, so a
 * refetch after a change does not blank the page.
 */
export function useMyFacilityClaims(ccaIds: number[]) {
	const [claims, setClaims] = useState<MyClaim[]>([]);
	const [loading, setLoading] = useState(true);
	const idsKey = ccaIds.join(",");

	const refetch = useCallback(async () => {
		const ids = idsKey ? idsKey.split(",") : [];
		try {
			const rows = await Promise.all(
				ids.map(async (id) => {
					const response = await fetch(`/api/facilities/claims?ccaId=${id}`);
					if (!response.ok) throw new Error("Failed to load bookings");
					return ((await response.json()).data ?? []) as ClaimRow[];
				}),
			);
			setClaims(
				rows
					.flat()
					.filter((row) => isBookableFacilityType(row.facility_type))
					.map((row) => ({
						claim_id: row.id,
						facility_id: row.facility_id,
						date: row.date,
						hour: row.hour,
						cca_id: row.cca_id,
						cca_name: row.cca_name,
						status: row.status,
						venue: row.venue,
						sub_venue: row.sub_venue,
					})),
			);
		} catch (error) {
			console.error("Error loading facility claims:", error);
			toast.error("Failed to load bookings");
		} finally {
			setLoading(false);
		}
	}, [idsKey]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	return { claims, loading, refetch };
}

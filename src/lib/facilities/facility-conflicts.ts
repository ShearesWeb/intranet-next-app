import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { ConflictView, ClaimStatus } from "@/types/facilities";

function daysUntil(dateStr: string): number {
	const target = new Date(dateStr + "T00:00:00");
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function buildConflictViews(
	rows: Array<{
		facility_id: number;
		facility: {
			id: number;
			booked_date: string;
			venue: string;
			sub_venue: string;
			activity: string;
			time_from: string;
			time_to: string;
			type: string;
			remark: string | null;
		};
		claims: Array<{
			id: number;
			cca_id: number;
			activity: string;
			status: string;
			recurrence_group: string | null;
			claimed_by: string;
			claimed_at: string;
			resolved_at: string | null;
			resolved_by: string | null;
			cca_name: string;
		}>;
	}>,
): Promise<ConflictView[]> {
	const supabase = await createClient();

	const claimedByIds = [...new Set(rows.flatMap((r) => r.claims.map((c) => c.claimed_by)))];

	const userDirectory: Map<string, { name: string; telegram: string }> = new Map();

	if (claimedByIds.length > 0) {
		const { data: users } = await supabase
			.from("authenticated_user_directory")
			.select("auth_id, name, telegram_handle")
			.in("auth_id", claimedByIds);

		for (const u of users ?? []) {
			userDirectory.set(u.auth_id, {
				name: u.name ?? "Unknown",
				telegram: u.telegram_handle ?? "",
			});
		}
	}

	return rows.map((row) => {
		const daysLeft = daysUntil(row.facility.booked_date);
		return {
			facility: {
				id: row.facility.id,
				booked_date: row.facility.booked_date,
				venue: row.facility.venue,
				sub_venue: row.facility.sub_venue,
				activity: row.facility.activity,
				time_from: row.facility.time_from,
				time_to: row.facility.time_to,
				type: row.facility.type as "sheares" | "reboks" | "nus" | "external",
				remark: row.facility.remark,
			},
			claimants: row.claims.map((c) => {
				const userInfo = userDirectory.get(c.claimed_by);
				return {
					claim: {
						id: c.id,
						facility_id: row.facility_id,
						cca_id: c.cca_id,
						cca_name: c.cca_name,
						activity: c.activity,
						status: c.status as ClaimStatus,
						recurrence_group: c.recurrence_group,
						claimed_by: c.claimed_by,
						claimed_at: c.claimed_at,
						resolved_at: c.resolved_at,
						resolved_by: c.resolved_by,
					},
					cca_name: c.cca_name,
					chair_name: userInfo?.name ?? "Unknown",
					chair_telegram: userInfo?.telegram ?? "",
				};
			}),
			days_until_booking: daysLeft,
			escalated: daysLeft <= 3,
		};
	});
}

export async function getConflictsForCca(ccaIds: number[]): Promise<ConflictView[]> {
	const supabase = await createClient();

	const { data: myClaims, error: myError } = await supabase
		.from("facility_claims")
		.select("facility_id")
		.in("cca_id", ccaIds)
		.eq("status", "conflicted");

	if (myError) {
		console.error("Error fetching conflicted claims:", myError);
		throw new ApiError(500, "Failed to load conflicts");
	}

	if (!myClaims || myClaims.length === 0) return [];

	const facilityIds = [...new Set(myClaims.map((c) => c.facility_id))];

	const { data: allClaims, error: allError } = await supabase
		.from("facility_claims")
		.select("*, ccas(name), facilities(*)")
		.in("facility_id", facilityIds)
		.not("status", "in", "('cancelled','yielded')");

	if (allError) {
		console.error("Error fetching all conflict claims:", allError);
		throw new ApiError(500, "Failed to load conflict details");
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const grouped = new Map<number, { facility_id: number; facility: any; claims: any[] }>();

	for (const row of allClaims ?? []) {
		const existing = grouped.get(row.facility_id);
		const claimWithName = { ...row, cca_name: (row.ccas as { name: string })?.name ?? "Unknown" };
		if (existing) {
			existing.claims.push(claimWithName);
		} else {
			grouped.set(row.facility_id, {
				facility_id: row.facility_id,
				facility: row.facilities,
				claims: [claimWithName],
			});
		}
	}

	const conflictRows = [...grouped.values()].filter((g) => g.claims.length > 1);

	return buildConflictViews(conflictRows as Parameters<typeof buildConflictViews>[0]);
}

export async function getAllConflicts(): Promise<ConflictView[]> {
	const supabase = await createClient();

	const { data: conflictedClaims, error } = await supabase
		.from("facility_claims")
		.select("facility_id")
		.eq("status", "conflicted");

	if (error) {
		console.error("Error fetching all conflicted claims:", error);
		throw new ApiError(500, "Failed to load conflicts");
	}

	if (!conflictedClaims || conflictedClaims.length === 0) return [];

	const facilityIds = [...new Set(conflictedClaims.map((c) => c.facility_id))];

	const { data: allClaims, error: allError } = await supabase
		.from("facility_claims")
		.select("*, ccas(name), facilities(*)")
		.in("facility_id", facilityIds)
		.not("status", "in", "('cancelled','yielded')");

	if (allError) {
		console.error("Error fetching all conflict claims:", allError);
		throw new ApiError(500, "Failed to load conflict details");
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const grouped = new Map<number, { facility_id: number; facility: any; claims: any[] }>();

	for (const row of allClaims ?? []) {
		const existing = grouped.get(row.facility_id);
		const claimWithName = { ...row, cca_name: (row.ccas as { name: string })?.name ?? "Unknown" };
		if (existing) {
			existing.claims.push(claimWithName);
		} else {
			grouped.set(row.facility_id, {
				facility_id: row.facility_id,
				facility: row.facilities,
				claims: [claimWithName],
			});
		}
	}

	const conflictRows = [...grouped.values()].filter((g) => g.claims.length > 1);

	return buildConflictViews(conflictRows as Parameters<typeof buildConflictViews>[0]);
}

export async function overrideConflict(
	facilityId: number,
	winningCcaId: number,
	resolvedByUserId: string,
): Promise<void> {
	const supabase = await createClient();

	const { data: claims, error: fetchError } = await supabase
		.from("facility_claims")
		.select("id, cca_id, status")
		.eq("facility_id", facilityId)
		.not("status", "in", "('cancelled','yielded')");

	if (fetchError) {
		console.error("Error fetching claims for override:", fetchError);
		throw new ApiError(500, "Failed to load claims");
	}

	if (!claims || claims.length === 0) {
		throw new ApiError(404, "No active claims found for this slot");
	}

	const winnerClaim = claims.find((c) => c.cca_id === winningCcaId);
	if (!winnerClaim) {
		throw new ApiError(400, "Selected CCA does not have a claim on this slot");
	}

	const loserIds = claims.filter((c) => c.id !== winnerClaim.id).map((c) => c.id);
	const now = new Date().toISOString();

	const { error: approveError } = await supabase
		.from("facility_claims")
		.update({ status: "approved", resolved_at: now, resolved_by: resolvedByUserId })
		.eq("id", winnerClaim.id);

	if (approveError) {
		console.error("Error approving winner:", approveError);
		throw new ApiError(500, "Failed to approve winning claim");
	}

	if (loserIds.length > 0) {
		const { error: yieldError } = await supabase
			.from("facility_claims")
			.update({ status: "yielded", resolved_at: now, resolved_by: resolvedByUserId })
			.in("id", loserIds);

		if (yieldError) {
			console.error("Error yielding losers:", yieldError);
			throw new ApiError(500, "Failed to yield other claims");
		}
	}
}

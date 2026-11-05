import { requireJcrcAccess } from "@/lib/api/auth";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	listPendingApprovals,
	listUpcomingConfirmed,
	rejectClaims,
	resolveSlot,
} from "@/lib/facilities/facility-approvals";
import { deleteClaims, getClaimOwners } from "@/lib/facilities/facility-claims";
import { todayKey } from "@/lib/date";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * How far ahead the approvals queue looks.
 *
 * Slots are computed, so the queue is a window over `facility_slots()` rather
 * than a table scan. Cost is linear in slots returned, so this stays a few
 * weeks rather than the 366-day maximum the function permits.
 */
const APPROVAL_WINDOW_DAYS = 28;

function windowEnd(from: string, days: number): string {
	const end = new Date(from + "T00:00:00");
	end.setDate(end.getDate() + days);
	return end.toISOString().slice(0, 10);
}

async function areShearesClaims(claimIds: number[]): Promise<boolean> {
	const distinct = new Set(claimIds);
	const owners = await getClaimOwners([...distinct]);
	return owners.length === distinct.size && owners.every((c) => c.facility_type === "sheares");
}

/** Multi-hour requests name several claims; a single-hour action names just one. */
function targetClaims(claimId: unknown, claimIds: unknown): number[] {
	if (Array.isArray(claimIds)) return claimIds as number[];
	return claimId != null ? [claimId as number] : [];
}

/** JCRC approvals queue: slots awaiting approval + upcoming confirmed (revocable). */
export async function GET() {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const from = todayKey();
		const to = windowEnd(from, APPROVAL_WINDOW_DAYS);

		const [pending, confirmed] = await Promise.all([
			listPendingApprovals(from, to),
			listUpcomingConfirmed(from, to),
		]);
		return apiOk({
			pending: pending.filter((item) => item.slot.type === "sheares"),
			confirmed: confirmed.filter((item) => item.slot.type === "sheares"),
		});
	} catch (e) {
		return handleApiError(e);
	}
}

/**
 * JCRC acts on a request: approve its claims (rejecting their competitors),
 * reject them, or revoke a confirmed booking.
 *
 * Actions are keyed by claim id rather than booking id — there is no booking
 * row to name. Revoking deletes the claim, since there is no cancelled status.
 */
export async function POST(req: NextRequest) {
	const disabledResponse = getCoreServiceDisabledApiResponse("facilities");
	if (disabledResponse) return disabledResponse;

	try {
		await requireJcrcAccess();
		const { action, claim_id, claim_ids, competing_claim_ids } = await req.json();

		const targets = targetClaims(claim_id, claim_ids);

		if (action === "approve") {
			if (!targets.length) return apiError("claim_id or claim_ids is required to approve", 400);
			const competitors = Array.isArray(competing_claim_ids) ? competing_claim_ids : [];
			if (!(await areShearesClaims([...targets, ...competitors]))) {
				return apiError("Only Sheares facility claims can be managed", 403);
			}
			await resolveSlot(targets, competitors);
		} else if (action === "reject") {
			// Rejecting a contested slot has to clear every claim on it, not just one.
			if (!targets.length) return apiError("claim_id or claim_ids is required to reject", 400);
			if (!(await areShearesClaims(targets))) {
				return apiError("Only Sheares facility claims can be managed", 403);
			}
			await rejectClaims(targets);
		} else if (action === "revoke") {
			if (!targets.length) return apiError("claim_id or claim_ids is required to revoke", 400);
			if (!(await areShearesClaims(targets))) {
				return apiError("Only Sheares facility claims can be managed", 403);
			}
			await deleteClaims(targets);
		} else {
			return apiError("action must be approve, reject or revoke", 400);
		}

		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

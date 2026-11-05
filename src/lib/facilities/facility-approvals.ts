import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { getSlots } from "@/lib/facilities/facility-slots";
import { ApprovalClaimant, ConfirmedBookingView, SlotApprovalView } from "@/types/facilities";

/**
 * The approvals queue is derived from the computed calendar rather than from a
 * bookings table, because no bookings table exists. `facility_slots()` already
 * returns each slot's status and its live claims as JSON, so one call gives
 * both the queue and the claimant list.
 */
async function contactsFor(userIds: number[]) {
	const contacts = new Map<number, { name: string; telegram: string }>();
	if (!userIds.length) return contacts;

	const supabase = await createClient();
	const { data: users } = await supabase
		.from("users")
		.select("id, name, telegram_handle")
		.in("id", userIds);

	for (const u of users ?? []) {
		contacts.set(u.id, { name: u.name ?? "", telegram: u.telegram_handle ?? "" });
	}
	return contacts;
}

/** When each claim was made. `facility_slots()` does not carry this. */
async function requestTimesFor(claimIds: number[]) {
	const times = new Map<number, string>();
	if (!claimIds.length) return times;

	const supabase = await createClient();
	const { data } = await supabase
		.from("facility_claims")
		.select("id, created_at")
		.in("id", claimIds);

	for (const row of data ?? []) {
		times.set(row.id, row.created_at);
	}
	return times;
}

/** Every slot with outstanding claims (single or competing), with chair contacts. */
export async function listPendingApprovals(from: string, to: string): Promise<SlotApprovalView[]> {
	const slots = await getSlots(from, to);
	const awaiting = slots.filter(
		(slot) => slot.status === "pending" || slot.status === "conflicted",
	);

	if (!awaiting.length) return [];

	const claimerIds = [
		...new Set(
			awaiting.flatMap((slot) =>
				slot.claims
					.filter((claim) => claim.status === "pending")
					.map((claim) => claim.created_by)
					.filter((id): id is number => typeof id === "number"),
			),
		),
	];

	const [contacts, requestTimes] = await Promise.all([
		contactsFor(claimerIds),
		requestTimesFor(
			awaiting.flatMap((slot) =>
				slot.claims.filter((claim) => claim.status === "pending").map((claim) => claim.claim_id),
			),
		),
	]);

	return awaiting.map((slot) => {
		const claimants: ApprovalClaimant[] = slot.claims
			.filter((claim) => claim.status === "pending")
			.map((claim) => {
				const contact = claim.created_by ? contacts.get(claim.created_by) : undefined;
				return {
					claim,
					cca_name: claim.cca_name,
					chair_name: contact?.name ?? "",
					chair_telegram: contact?.telegram ?? "",
					requested_at: requestTimes.get(claim.claim_id) ?? null,
				};
			});

		return {
			slot,
			claimants,
		};
	});
}

/** Upcoming confirmed bookings with the holding CCA — JCRC can revoke these. */
export async function listUpcomingConfirmed(
	from: string,
	to: string,
): Promise<ConfirmedBookingView[]> {
	const slots = (await getSlots(from, to)).filter((slot) => slot.status === "confirmed");
	const contacts = await contactsFor([
		...new Set(
			slots
				.flatMap((slot) => slot.claims)
				.filter((claim) => claim.status === "approved")
				.map((claim) => claim.created_by)
				.filter((id): id is number => typeof id === "number"),
		),
	]);

	return slots
		.map((slot) => {
			// At most one claim per slot is ever approved, which is what makes
			// `confirmed` unambiguous.
			const approved = slot.claims.find((claim) => claim.status === "approved");
			const contact = approved?.created_by ? contacts.get(approved.created_by) : undefined;
			return {
				slot,
				cca_name: approved?.cca_name ?? "Unknown CCA",
				chair_name: contact?.name ?? "",
				claim_id: approved?.claim_id ?? 0,
			};
		})
		.filter((view) => view.claim_id !== 0);
}

/** Reject every named claim, freeing the slot for those CCAs to claim again. */
export async function rejectClaims(claimIds: number[]): Promise<void> {
	if (!claimIds.length) return;

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("facility_claims")
		.update({ status: "rejected" })
		.in("id", claimIds)
		.select("id");

	if (error) {
		console.error("Error rejecting claims:", error);
		throw new ApiError(500, "Failed to reject claims");
	}

	// A filtered UPDATE matches no rows rather than raising.
	if (!data || data.length === 0) {
		throw new ApiError(403, "Only JCRC may resolve or reopen a facility claim");
	}
}

/**
 * Approve a request (one or more hourly claims) and reject its competitors.
 *
 * Ordering matters: `uq_facility_claims_approved_slot` allows only one approved
 * claim per slot, so the losers are rejected first. Both statements go through
 * the JCRC-only UPDATE policy.
 */
export async function resolveSlot(claimIds: number[], competingClaimIds: number[]): Promise<void> {
	const supabase = await createClient();

	const winners = new Set(claimIds);
	const losers = competingClaimIds.filter((id) => !winners.has(id));

	if (losers.length) {
		const { error: rejectError } = await supabase
			.from("facility_claims")
			.update({ status: "rejected" })
			.in("id", losers);

		if (rejectError) {
			console.error("Error rejecting competing claims:", rejectError);
			throw new ApiError(500, "Failed to reject competing claims");
		}
	}

	const { data, error } = await supabase
		.from("facility_claims")
		.update({ status: "approved" })
		.in("id", claimIds)
		.select("id");

	if (error) {
		if (error.code === "23505") {
			throw new ApiError(409, "That slot is already confirmed for another CCA");
		}
		console.error("Error approving claim:", error);
		throw new ApiError(500, "Failed to approve claim");
	}

	// A filtered UPDATE matches no rows rather than raising.
	if (!data || data.length === 0) {
		throw new ApiError(403, "Only JCRC may resolve or reopen a facility claim");
	}
}

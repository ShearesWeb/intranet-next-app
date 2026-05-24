import { checkCcaAuthorization, type AccessResult } from "@/lib/cca/cca-chair-access";
import { AuthenticatedUser } from "@/types/user";
import { createClient } from "@/lib/supabase/server";

type ManagedCcaAccessRow = {
	cca_id: number;
	cca_name: string | null;
	positions: Array<{
		position_id: number;
	}> | null;
};

type AccessLevel = "manage_members" | "rank_members" | "either";

/**
 * Resolves whether the requesting user has chair / managed-ranking access to a CCA
 * and (when `requireAccess` is true) short-circuits with a friendly 403 if not.
 *
 * Note: this helper is for UX-friendly early returns. The DB is the authoritative
 * guard — RLS on `cca_appointments` (and on `cca_appointment_evaluations` for the
 * ranking domain) enforces writes via `internal.can_manage_cca_appointments`. If
 * this helper allows a request through but the caller is not actually permitted,
 * the subsequent Supabase write will be rejected by RLS.
 */
export async function getManagedCcaAccess({
	supabase,
	requestingUser,
	cca,
	requireAccess = true,
	accessLevel = "either",
}: {
	supabase: Awaited<ReturnType<typeof createClient>>;
	requestingUser: Pick<AuthenticatedUser, "id" | "appointments"> | null | undefined;
	cca: { id: number; name?: string | null; cca_type?: string | null };
	requireAccess?: boolean;
	accessLevel?: AccessLevel;
}): Promise<
	AccessResult<{
		hasChairAccess: boolean;
		hasManagedRankingAccess: boolean;
		managedPositionIds: number[];
		managedCca: ManagedCcaAccessRow | null;
	}>
> {
	if (!requestingUser) {
		return { ok: false, status: 401, error: "Unauthorized" };
	}

	// `checkCcaAuthorization` is now async (DB-widened reporting-chain check via
	// `public.can_manage_any_position_in_cca`); pass `supabase` so the widened
	// path is consulted when the JWT fast path doesn't grant access.
	const chairAccessResult = await checkCcaAuthorization({
		requestingUser,
		cca,
		supabase,
	});

	const { data: managedCca, error } = await supabase
		.from("managed_cca_positions")
		.select("cca_id, cca_name, positions")
		.eq("cca_id", cca.id)
		.maybeSingle();

	if (error) {
		console.error("Error loading managed CCA access:", error);
		return { ok: false, status: 500, error: "Failed to verify access" };
	}

	const managedPositionIds = ((managedCca as ManagedCcaAccessRow | null)?.positions || [])
		.map((position) => position.position_id)
		.filter((positionId): positionId is number => typeof positionId === "number");

	const hasChairAccess = chairAccessResult.ok && chairAccessResult.data.hasChairAccess;
	const hasManagedRankingAccess = managedPositionIds.length > 0;
	const hasRequiredAccess =
		accessLevel === "manage_members"
			? hasChairAccess
			: accessLevel === "rank_members"
				? hasManagedRankingAccess
				: hasChairAccess || hasManagedRankingAccess;

	if (requireAccess && !hasRequiredAccess) {
		return {
			ok: false,
			status: 403,
			error:
				accessLevel === "rank_members"
					? "You are not authorized to view rankings for this CCA"
					: "You are not authorized to manage this CCA",
		};
	}

	return {
		ok: true,
		data: {
			hasChairAccess,
			hasManagedRankingAccess,
			managedPositionIds,
			managedCca: (managedCca as ManagedCcaAccessRow | null) || null,
		},
	};
}

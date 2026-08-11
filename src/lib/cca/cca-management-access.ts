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
 * Resolves whether the requesting user has chair / managed access to a CCA and
 * (when `requireAccess` is true) short-circuits with a friendly 403 if not.
 *
 * This helper is for UX-friendly early returns. The DB is the authoritative
 * guard: RLS on `cca_appointments` gates writes on
 * `internal.managed_position_ids(internal.auth_user_id())`. If this helper lets
 * a request through but the caller is not actually permitted, the subsequent
 * Supabase write is rejected by RLS.
 */
export async function getManagedCcaAccess({
	supabase,
	requestingUser,
	cca,
	requireAccess = true,
	accessLevel = "either",
}: {
	supabase: Awaited<ReturnType<typeof createClient>>;
	requestingUser: Pick<AuthenticatedUser, "id" | "appointments" | "is_chair"> | null | undefined;
	cca: { id: number; name?: string | null };
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

	// Pass `supabase` so `can_manage_cca` walks the reporting chain rather than
	// trusting the profile hint, which cannot see cross-CCA reporting.
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

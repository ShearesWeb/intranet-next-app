import { AuthenticatedUser, UserAppointment } from "@/types/user";
import { createClient } from "@/lib/supabase/server";

/**
 * Discriminated-union access result. `degraded: true` indicates the result was
 * produced from `my_profile` data alone (no DB round-trip) because no supabase
 * client was supplied or because the helper is the sync `*FromProfile` variant.
 * Callers needing an authoritative answer should call the async
 * `checkCcaAuthorization` with a supabase client so the DB RPC is consulted.
 */
export type AccessResult<T> =
	| { ok: true; data: T; degraded?: boolean }
	| { ok: false; status: number; error: string; degraded?: boolean };

/**
 * Whether holding this appointment puts positions in the caller's management
 * chain.
 *
 * Authority comes from the reporting chain, never from `position_type`: a
 * `lead` with nobody reporting to it manages nothing, and a `maincomm` head
 * over a `subcomm` manages plenty. `has_reports` is projected by `my_profile`
 * precisely so clients stop inferring this from the title.
 *
 * See: intranet/docs/api/README.md#the-management-chain
 */
export function isManagingAppointment(appointment: Pick<UserAppointment, "has_reports">) {
	return appointment.has_reports === true;
}

const LEADERSHIP_POSITION_TYPES = new Set<string>(["lead", "vice"]);

/**
 * Whether a position is a leadership seat by title.
 *
 * Presentation only — for filtering pickers that should not offer `lead` or
 * `vice` as an ordinary membership slot. Never use it to decide what a caller
 * may do; that is `isManagingAppointment` or the `can_manage_cca*` RPCs.
 */
export function isLeadershipPositionType(positionType?: string | null) {
	return LEADERSHIP_POSITION_TYPES.has((positionType || "").toLowerCase().trim());
}

/**
 * Position types a CCA's own management (chair, captain) must not hand out
 * from the Add Member picker.
 *
 * `lead` / `vice` are leadership seats; `team-manager` sits outside the roster
 * a captain controls, so the picker must not offer it either.
 */
const CHAIR_UNASSIGNABLE_POSITION_TYPES = new Set<string>([
	...LEADERSHIP_POSITION_TYPES,
	"team-manager",
]);

/**
 * Whether a chair/captain may assign this position when adding a member.
 *
 * Presentation only — for filtering the Add Member picker down to the seats a
 * CCA's own management fills. Never use it to decide what a caller may do;
 * that is `isManagingAppointment` or the `can_manage_cca*` RPCs.
 */
export function isChairAssignablePositionType(positionType?: string | null) {
	return !CHAIR_UNASSIGNABLE_POSITION_TYPES.has((positionType || "").toLowerCase().trim());
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ChairAccessData = {
	userId: number;
	hasChairAccess: boolean;
	authorizedCcaIds: number[];
	viaReportingChain?: boolean;
};

type ProfileLike = Pick<AuthenticatedUser, "id" | "appointments" | "is_chair">;

/**
 * CCAs in which the caller holds a position that has reports.
 *
 * A hint, not an authority. `reporting_position_id` may cross CCAs, so a
 * position with reports can manage positions in a *different* CCA than the one
 * it belongs to. Use `can_manage_cca` when the answer has to be right.
 */
function managedCcaIdHints(user: ProfileLike): number[] {
	return Array.from(
		new Set((user.appointments || []).filter(isManagingAppointment).map((a) => a.cca_id)),
	);
}

/**
 * Calls the public RPC `can_manage_cca`, which derives the caller's user id
 * from the JWT via `internal.auth_user_id()` and returns TRUE iff the caller
 * manages any position in the given CCA via the reporting chain.
 *
 * Returns FALSE for unauthenticated callers; on RPC error or thrown exception
 * we conservatively return FALSE.
 */
export async function canManageCcaServerSide(
	supabase: SupabaseServerClient,
	ccaId: number,
): Promise<boolean> {
	try {
		const { data, error } = await supabase.rpc("can_manage_cca", { p_cca_id: ccaId });

		if (error) {
			console.error("can_manage_cca RPC error:", error);
			return false;
		}

		return data === true;
	} catch (err) {
		console.error("can_manage_cca RPC threw:", err);
		return false;
	}
}

/**
 * True if the caller may write `cca_appointments` rows against that position.
 * Use it to decide whether to render a management control, so the UI matches
 * what the policy will allow.
 */
export async function canManagePositionServerSide(
	supabase: SupabaseServerClient,
	positionId: number,
): Promise<boolean> {
	try {
		const { data, error } = await supabase.rpc("can_manage_cca_position", {
			p_position_id: positionId,
		});

		if (error) {
			console.error("can_manage_cca_position RPC error:", error);
			return false;
		}

		return data === true;
	} catch (err) {
		console.error("can_manage_cca_position RPC threw:", err);
		return false;
	}
}

/**
 * Synchronous profile-only chair check. Use from client components (e.g. the
 * sidebar) where you cannot await a DB round-trip. Results are marked
 * `degraded: true` because the reporting chain has not been walked.
 *
 * `is_chair === false` is definitive: the caller manages nothing anywhere, so
 * no CCA-specific check can succeed. `is_chair === true` only narrows it.
 */
export function checkCcaAuthorizationFromProfile({
	requestingUser,
	cca,
	require,
}: {
	requestingUser: ProfileLike | null | undefined;
	cca?: { id: number; name?: string | null } | null;
	require?: "chair";
}): AccessResult<ChairAccessData> {
	if (!requestingUser) {
		return { ok: false, status: 401, error: "Unauthorized" };
	}

	const authorizedCcaIds = managedCcaIdHints(requestingUser);
	const plausible = cca
		? requestingUser.is_chair && authorizedCcaIds.includes(cca.id)
		: requestingUser.is_chair;

	if (require === "chair" && !plausible) {
		return {
			ok: false,
			status: 403,
			error: "You are not authorized to manage this CCA",
			degraded: true,
		};
	}

	return {
		ok: true,
		data: {
			userId: requestingUser.id,
			hasChairAccess: plausible,
			authorizedCcaIds,
		},
		degraded: true,
	};
}

/**
 * Resolves whether the requesting user has chair-style access to the given CCA.
 *
 * Resolution order:
 * 1. `is_chair === false` — the caller manages nothing anywhere, so deny
 *    immediately without a round-trip.
 * 2. DB check (only when `supabase` and `cca` are supplied) — calls
 *    `can_manage_cca`, which walks the reporting chain (depth ≤ 10). This is
 *    the authority, and it catches cross-CCA reporting that the profile hints
 *    cannot see.
 * 3. No client supplied — fall back to the profile hint, marked `degraded`.
 *
 * The old lead/vice fast path is gone. It produced both false negatives (a
 * maincomm head over a subcomm) and, with cross-CCA reporting, false positives.
 */
export async function checkCcaAuthorization({
	requestingUser,
	cca,
	require,
	supabase,
}: {
	requestingUser: ProfileLike | null | undefined;
	cca?: { id: number; name?: string | null } | null;
	require?: "chair";
	supabase?: SupabaseServerClient;
}): Promise<AccessResult<ChairAccessData>> {
	if (!requestingUser) {
		return { ok: false, status: 401, error: "Unauthorized" };
	}

	const authorizedCcaIds = managedCcaIdHints(requestingUser);

	if (!requestingUser.is_chair) {
		if (require === "chair") {
			return { ok: false, status: 403, error: "You are not authorized to manage this CCA" };
		}
		return {
			ok: true,
			data: { userId: requestingUser.id, hasChairAccess: false, authorizedCcaIds },
		};
	}

	if (cca && supabase) {
		const canManage = await canManageCcaServerSide(supabase, cca.id);

		if (canManage) {
			return {
				ok: true,
				data: {
					userId: requestingUser.id,
					hasChairAccess: true,
					authorizedCcaIds,
					viaReportingChain: true,
				},
			};
		}

		if (require === "chair") {
			return { ok: false, status: 403, error: "You are not authorized to manage this CCA" };
		}

		return {
			ok: true,
			data: { userId: requestingUser.id, hasChairAccess: false, authorizedCcaIds },
		};
	}

	// No DB check possible. Fall back to the profile hint.
	const plausible = cca ? authorizedCcaIds.includes(cca.id) : true;

	if (require === "chair" && !plausible) {
		return {
			ok: false,
			status: 403,
			error: "You are not authorized to manage this CCA",
			degraded: true,
		};
	}

	return {
		ok: true,
		data: { userId: requestingUser.id, hasChairAccess: plausible, authorizedCcaIds },
		degraded: true,
	};
}

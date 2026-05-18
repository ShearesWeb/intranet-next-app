import { AuthenticatedUser } from "@/types/User";
import { createClient } from "@/utils/supabase/server";

/**
 * Discriminated-union access result. `degraded: true` indicates the result was
 * produced from JWT/appointment data alone (no DB round-trip) because no supabase
 * client was supplied or because the helper is the sync `*FromJwt` variant.
 * Callers needing the widened reporting-chain semantics should call the async
 * `checkCcaAuthorization` with a supabase client so the DB RPC is consulted.
 */
export type AccessResult<T> =
	| { ok: true; data: T; degraded?: boolean }
	| { ok: false; status: number; error: string; degraded?: boolean };

const CHAIR_POSITION_TYPES = new Set(["lead", "vice"]);

export function isChairPositionType(positionType?: string | null) {
	return CHAIR_POSITION_TYPES.has((positionType || "").toLowerCase().trim());
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ChairAccessData = {
	userId: number;
	hasChairAccess: boolean;
	authorizedCcaIds: number[];
	viaReportingChain?: boolean;
};

/**
 * Calls the public RPC wrapper `can_manage_any_position_in_cca`, which derives the
 * caller's user id from the JWT via `internal.auth_user_id()` and returns TRUE iff
 * the caller can manage any position in the given CCA via the reporting chain.
 *
 * The RPC returns FALSE for unauthenticated callers; on RPC error or thrown
 * exception we conservatively return FALSE.
 */
export async function canManageCcaServerSide(
	supabase: SupabaseServerClient,
	ccaId: number,
): Promise<boolean> {
	try {
		const { data, error } = await supabase.rpc("can_manage_any_position_in_cca", {
			p_cca_id: ccaId,
		});

		if (error) {
			console.error("can_manage_any_position_in_cca RPC error:", error);
			return false;
		}

		return data === true;
	} catch (err) {
		console.error("can_manage_any_position_in_cca RPC threw:", err);
		return false;
	}
}

/**
 * Synchronous JWT-only chair-access check. Use this from client components
 * (e.g. the sidebar) where you cannot await a DB round-trip. Results are
 * marked `degraded: true` because the DB widened reporting-chain check has
 * not been consulted; for authoritative server-side checks (especially in
 * API routes that mutate data), call the async `checkCcaAuthorization`
 * with a supabase client instead.
 */
export function checkCcaAuthorizationFromJwt({
	requestingUser,
	cca,
	require,
}: {
	requestingUser: Pick<AuthenticatedUser, "id" | "appointments"> | null | undefined;
	cca?: { id: number; name?: string | null; cca_type?: string | null } | null;
	require?: "chair";
}): AccessResult<ChairAccessData> {
	if (!requestingUser) {
		return { ok: false, status: 401, error: "Unauthorized" };
	}

	const authorizedCcaIds = Array.from(
		new Set(
			(requestingUser.appointments || [])
				.filter((appointment) => isChairPositionType(appointment.position_type))
				.map((appointment) => appointment.cca_id),
		),
	);

	const jwtSaysChair = cca ? authorizedCcaIds.includes(cca.id) : authorizedCcaIds.length > 0;

	if (require === "chair" && !jwtSaysChair) {
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
			hasChairAccess: jwtSaysChair,
			authorizedCcaIds,
		},
		degraded: true,
	};
}

/**
 * Resolves whether the requesting user has chair-style access to the given CCA.
 *
 * Resolution order:
 * 1. JWT fast path — if the caller's appointments include a `lead`/`vice` row
 *    for the target CCA, grant access immediately (no DB round-trip).
 * 2. DB widened check (only when `supabase` is supplied) — calls the public
 *    RPC `can_manage_any_position_in_cca`, which walks the reporting chain
 *    (depth ≤ 10) and returns TRUE if the caller manages any position in the
 *    CCA via that chain. This catches e.g. a `maincomm` head over a `subcomm`
 *    position whose own appointment isn't `lead`/`vice`.
 * 3. If both signals say no, return `{ ok: false, status: 403 }` (when
 *    `require === "chair"`) or `{ ok: true, hasChairAccess: false }`.
 *
 * If `supabase` is omitted, the result is marked `degraded: true` so callers
 * can decide whether to retry with a server check. This is async because the
 * DB widened check requires a round-trip; callers in tight loops should call
 * it once and reuse the result.
 */
export async function checkCcaAuthorization({
	requestingUser,
	cca,
	require,
	supabase,
}: {
	requestingUser: Pick<AuthenticatedUser, "id" | "appointments"> | null | undefined;
	cca?: { id: number; name?: string | null; cca_type?: string | null } | null;
	require?: "chair";
	supabase?: SupabaseServerClient;
}): Promise<AccessResult<ChairAccessData>> {
	if (!requestingUser) {
		return { ok: false, status: 401, error: "Unauthorized" };
	}

	const authorizedCcaIds = Array.from(
		new Set(
			(requestingUser.appointments || [])
				.filter((appointment) => isChairPositionType(appointment.position_type))
				.map((appointment) => appointment.cca_id),
		),
	);

	const jwtSaysChair = cca ? authorizedCcaIds.includes(cca.id) : authorizedCcaIds.length > 0;

	if (jwtSaysChair) {
		return {
			ok: true,
			data: {
				userId: requestingUser.id,
				hasChairAccess: true,
				authorizedCcaIds,
			},
		};
	}

	// JWT fast path failed. Consult the DB widened check if we have a CCA + client.
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
			data: {
				userId: requestingUser.id,
				hasChairAccess: false,
				authorizedCcaIds,
			},
		};
	}

	// No DB widened check possible. Fall back to JWT-only result.
	if (require === "chair") {
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
			hasChairAccess: jwtSaysChair,
			authorizedCcaIds,
		},
		degraded: true,
	};
}

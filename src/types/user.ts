/**
 * Shapes mirroring the `core` domain of the schema contract.
 *
 * See: intranet/docs/api/core.md and intranet/docs/api/enums.md
 */

/** `enum.position_type`. Declaration order is Postgres sort order. */
export type PositionType =
	| "lead"
	| "vice"
	| "blockcomm"
	| "maincomm"
	| "subcomm"
	| "team-manager"
	| "member"
	| "resident";

/**
 * `enum.cca_kind` — the activity family a CCA belongs to.
 *
 * Named `kind`, not `type`, and the distinction matters. Before the refactor
 * this vocabulary was called `enum.cca_type`. That name now belongs to a
 * different enum (see `CcaStructure`), so any app code still saying `cca_type`
 * and comparing against "sports" or "culture" compiles fine and matches
 * nothing.
 */
export type CcaKind = "sports" | "committee" | "culture" | "jcrc" | "adhoc" | "supplementary";

/** `enum.cca_type` — subcommittee structure. `type-a` has subcomms, `type-b` does not. */
export type CcaStructure = "none" | "type-a" | "type-b";

/** `enum.cca_tier` — KPI weighting band. */
export type CcaTier = "none" | "tier-1" | "tier-2";

/**
 * `enum.period`. One vocabulary for both `users.stay_period` and
 * `cca_appointments.commitment_period`, which were separate enums before.
 * `full-year` overlaps both semesters, which is what capacity and conflict
 * rules turn on.
 */
export type Period = "semester-1" | "semester-2" | "full-year";

/**
 * `enum.team_status`. Declared low to high, so `>` and sort order rank standing.
 * Replaces the old `enum.cut_status`, which had different values.
 */
export type TeamStatus = "none" | "shortlisted" | "reserve" | "main-team" | "varsity";

export interface UserAppointment {
	cca_id: number;
	cca_name: string;
	cca_kind: CcaKind;
	position_id: number;
	position_type: PositionType;
	position_name: string;
	/**
	 * True when at least one position reports into this one. This, not
	 * `position_type`, is what confers management authority — a `lead` with
	 * nobody under it manages nothing.
	 */
	has_reports: boolean;
	points: number;
	commitment_period: Period;
	team_status: TeamStatus;
}

/**
 * The caller's own profile, sourced from the `my_profile` view.
 *
 * `my_profile` replaces `authenticated_user_info`, `authenticated_user_directory`
 * and `public_user_info`. It is scoped to the caller by RLS and returns at most
 * one row.
 *
 * There is deliberately no `is_admin` or `is_culture_sports_admin`: the schema
 * dropped the admin concept, and kind-specific role predicates are now app
 * policy derived from `appointments`. See `deriveChairKinds` below.
 */
export interface AuthenticatedUser {
	id: number;
	email: string;
	name: string;
	room: string;
	points: number;
	profile_photo_url?: string | null;
	telegram_handle?: string | null;
	stay_period: Period;
	matric?: string | null;
	/** True if the caller manages at least one position anywhere. Agrees with `can_manage_cca`. */
	is_chair: boolean;
	/** True if the caller holds any appointment under a `jcrc`-kind CCA. */
	is_jcrc: boolean;
	appointments: UserAppointment[];
}

/**
 * The CCA kinds this caller chairs, derived rather than stored.
 *
 * A chair is an appointment with reports beneath it. Keeping this in the client
 * is deliberate: it lets the policy change without a migration.
 */
export function deriveChairKinds(user: Pick<AuthenticatedUser, "appointments">): Set<CcaKind> {
	const kinds = new Set<CcaKind>();
	for (const appointment of user.appointments ?? []) {
		if (appointment.has_reports) {
			kinds.add(appointment.cca_kind);
		}
	}
	return kinds;
}

/** Replaces the old `is_culture_sports_admin` flag. */
export function isCultureSportsChair(user: Pick<AuthenticatedUser, "appointments">): boolean {
	const kinds = deriveChairKinds(user);
	return kinds.has("culture") || kinds.has("sports");
}

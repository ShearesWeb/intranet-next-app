export interface CCAPosition {
	cca_id: number;
	cca_name: string;
	position_id: number;
	position_name: string;
}

export type PositionType =
	| "lead"
	| "vice"
	| "blockcomm"
	| "maincomm"
	| "subcomm"
	| "team manager"
	| "member"
	| "resident"
	| string;

export type CcaType = "sports" | "culture" | "committee" | string;

/**
 * Commitment period of an appointment. Sourced from `enum.commitment_period`
 * (see `intranet/db/changelogs/enum/`). Kept as a string literal union here
 * pending a wiki page that documents the canonical enum values.
 */
export type CommitmentPeriod = "full-year" | "semester-1" | "semester-2";

/**
 * Per-appointment cut status. Sourced from `enum.cut_status`
 * (see `intranet/db/changelogs/enum/`). `null` means the appointment
 * predates the cut-status workflow or is otherwise unset.
 */
export type CutStatus = "cut" | "active" | string;

export interface UserAppointment extends CCAPosition {
	position_type: PositionType;
	position_name: string;
	points: number;
	commitment_period: CommitmentPeriod;
	cut_status: CutStatus | null;
}

/**
 * Role flags surfaced from `authenticated_user_roles`. These are *derived*
 * per query from the user's appointments and the reporting chain of their
 * position(s) — they are not stored as columns on `public.users`.
 *
 * Setting a user as `is_admin` is therefore not a settable flag; the value
 * is true iff the user holds a position with subordinate positions in the
 * reporting chain. Same applies to `is_jcrc` (derived from holding a JCRC
 * position) and `is_culture_sports_admin` (derived from chair appointments
 * whose CCA is of type `culture`/`sports`).
 *
 * See: intranet-wiki/wiki/entity/view/public.authenticated_user_info.md
 */
export interface UserRoleFlags {
	is_admin: boolean;
	is_jcrc: boolean;
	is_culture_sports_admin: boolean;
}

export interface AuthenticatedUser extends UserRoleFlags {
	id: number;
	name: string;
	/**
	 * Maps to `public.users.display_name TEXT` (nullable). `undefined` if the
	 * view did not project the column; `null` if explicitly absent.
	 */
	display_name?: string | null;
	room: string;
	email: string;
	points: number;
	profile_photo_url?: string | null;
	appointments: UserAppointment[];
}

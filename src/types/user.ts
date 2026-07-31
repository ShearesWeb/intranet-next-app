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
type CutStatus = "cut" | "active" | string;

export interface UserAppointment {
	cca_id: number;
	cca_name: string;
	position_id: number;
	position_name: string;
	position_type: PositionType;
	points: number;
	commitment_period: CommitmentPeriod;
	cut_status: CutStatus | null;
}

export interface AuthenticatedUser {
	/**
	 * Role flags surfaced from `authenticated_user_roles`. These are *derived*
	 * per query from the user's appointments and the reporting chain of their
	 * position(s) — they are not stored as columns on `public.users`.
	 *
	 * See: intranet-wiki/wiki/entity/view/public.authenticated_user_info.md
	 */
	is_admin: boolean;
	is_jcrc: boolean;
	is_culture_sports_admin: boolean;
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

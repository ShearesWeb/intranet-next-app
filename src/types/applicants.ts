import type { PositionType } from "@/types/user";

/**
 * Chair-side applicant view model.
 *
 * The `ranking` field is the wire-name alias for `cca_position_preferences.rank`
 * (the chair-managed market). The alias is intentional: renaming through the
 * full chain (`forChair` route → hook → component → save payload) would have a
 * large blast radius for no functional gain, so the route and components keep
 * `ranking` and translate at the route boundary.
 */
export interface Applicant {
	id: number;
	name: string;
	email: string;
	room: string;
	ranking: number | null;
}

/**
 * Chair-side position view model. `applied_count` is derived from the count of
 * `cca_position_preferences` rows for the position (the chair-visible market;
 * RLS hides the reciprocal user-side ranks).
 */
export interface Position {
	id: number;
	cca_id: number;
	name: string;
	cca_name: string;
	capacity: number;
	available_capacity: number;
	applied_count: number;
	position_type: PositionType;
	applicants: Applicant[];
}

export interface CcaPositionGroup {
	cca_id: number;
	cca_name: string;
	positions: Position[];
}

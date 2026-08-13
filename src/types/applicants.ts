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
	// False for a candidate the chair added, who never applied themself.
	applied: boolean;
}

/**
 * Chair-side position view model. `applicants` is the whole roster — residents
 * who applied plus candidates the chair added — while `applied_count` counts
 * only the residents who applied themselves.
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

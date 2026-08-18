import type { PositionType } from "@/types/user";

/**
 * Chair-side candidate view model.
 *
 * The `ranking` field is the wire-name alias for `preferred_candidates.rank`
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
 * Chair-side position view model. `applicants` is the chair's own ranked
 * preference list (`preferred_candidates`) and nothing else — residents'
 * applications are private to them and never surface here, mirroring how
 * chairs' rankings never surface to residents.
 */
export interface Position {
	id: number;
	cca_id: number;
	name: string;
	cca_name: string;
	capacity: number;
	available_capacity: number;
	position_type: PositionType;
	applicants: Applicant[];
}

export interface CcaPositionGroup {
	cca_id: number;
	cca_name: string;
	positions: Position[];
}

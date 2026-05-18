import type { PositionType } from "@/types/User";

/**
 * User-side rankable position view model.
 * The `user_ranking` field is the wire-name alias for `cca_user_preferences.rank`.
 */
export interface RankablePosition {
	id: number;
	name: string;
	cca_name: string;
	position_type: PositionType;
	capacity: number;
	available_capacity: number;
	applied_count: number;
	description?: string;
	user_ranking?: number | null;
	is_selected?: boolean;
}

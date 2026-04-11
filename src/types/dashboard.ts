import { PositionType } from "./User";

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

export interface SportsCulturePosition {
	id: number;
	name: string;
	cca_name: string;
	cca_id: number;
	cca_type: "sports" | "culture";
	description: string | null;
	capacity: number | null;
	is_applied: boolean;
	user_current_role?: string;
	conflict_reason?: string;
	can_apply: boolean;
}

export interface GroupedPositions {
	sports: SportsCulturePosition[];
	culture: SportsCulturePosition[];
}

export interface Applicant {
	id: number;
	name: string;
	email: string;
	room: string;
	ranking: number | null;
}

export interface Position {
	id: number;
	name: string;
	cca_name: string;
	capacity: number;
	available_capacity: number;
	applied_count: number;
	position_type: PositionType;
	applicants: Applicant[];
}

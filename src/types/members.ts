import type { CcaKind, Period, PositionType, TeamStatus } from "@/types/user";

export type { Period, TeamStatus };

export interface Member {
	user_id: number;
	name: string;
	email: string;
	room: string;
	position_id?: number;
	position_name: string;
	position_type: PositionType;
	points: number;
	appointed_date: string;
	team_status?: TeamStatus | null;
	commitment_period?: Period | null;
}

export interface PendingChange {
	type: "add" | "remove" | "update_status" | "update_commitment";
	user_id: number;
	user_name: string;
	user_email: string;
	user_room?: string;
	new_status?: TeamStatus | null;
	new_commitment_period?: Period;
	position_id?: number;
	position_name?: string;
}

export interface UserSearchResult {
	id: number;
	name: string;
	email: string;
	room?: string | null;
}

export interface CcaSummary {
	id: number;
	name: string;
	cca_kind: CcaKind;
}

export interface MemberPermissions {
	canManageMembers: boolean;
	ccaKind: CcaKind | "";
	managementMessage: string;
}

export type GroupedMembers = Record<string, Member[]>;

export interface MemberJoinPosition {
	id: number;
	name: string;
	position_type: PositionType;
	cca_id: number;
}

export interface MemberWithJoins {
	user_id: number;
	points: number | null;
	created_at: string;
	team_status: TeamStatus | string | null;
	commitment_period: Period | null;
	users:
		| { id: number; name: string; email: string; room: string }
		| { id: number; name: string; email: string; room: string }[]
		| null;
	cca_positions: MemberJoinPosition | MemberJoinPosition[] | null;
}

export type MemberUpdate = Partial<{
	team_status: TeamStatus | null;
	commitment_period: Period;
}>;

import type { CcaType, CommitmentPeriod, PositionType } from "@/types/user";

export type { CommitmentPeriod };

export type CutStatus = "ivp-ihg-team" | "ihg-team" | "final-cut" | "first-cut";

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
	cut?: boolean;
	cut_status?: CutStatus | null;
	commitment_period?: CommitmentPeriod | null;
}

export interface PendingChange {
	type: "add" | "remove" | "cut" | "update_status" | "update_commitment";
	user_id: number;
	user_name: string;
	user_email: string;
	user_room?: string;
	new_status?: CutStatus | null;
	new_commitment_period?: CommitmentPeriod;
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
	cca_type: CcaType;
}

export interface MemberPermissions {
	canManageMembers: boolean;
	ccaType: CcaType | "";
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
	cut_status: CutStatus | string | null;
	commitment_period: CommitmentPeriod | null;
	authenticated_user_directory:
		| { id: number; name: string; email: string; room: string }
		| { id: number; name: string; email: string; room: string }[]
		| null;
	cca_positions: MemberJoinPosition | MemberJoinPosition[] | null;
}

export type MemberUpdate = Partial<{
	cut_status: CutStatus | null;
	commitment_period: CommitmentPeriod;
}>;

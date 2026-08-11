import type { CcaKind, PositionType, TeamStatus } from "@/types/user";

export interface ManagedCcaPosition {
	position_id: number;
	position_name: string;
	position_type: PositionType;
	description: string | null;
}

export interface CCAData {
	id: number;
	name: string;
	role: string;
	position_type: PositionType;
	cca_kind: CcaKind;
	description: string;
	points: number;
	team_status?: TeamStatus | null;
	positions?: ManagedCcaPosition[];
	can_manage_members?: boolean;
}

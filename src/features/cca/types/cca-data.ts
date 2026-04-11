import type { CcaType, PositionType } from "@/types/User";
import type { CutStatus } from "@/features/cca/types/members";

export interface ManagedCcaPosition {
	position_id: number;
	position_name: string;
	position_type: PositionType;
	description: string | null;
	access_depth: number;
}

export interface CCAData {
	id: number;
	name: string;
	role: string;
	position_type: PositionType;
	cca_type: CcaType;
	description: string;
	points: number;
	cut_status?: CutStatus | null;
	positions?: ManagedCcaPosition[];
	can_manage_members?: boolean;
	can_rank_members?: boolean;
}

import type { CommitmentPeriod, CutStatus } from "@/types/members";

export interface CCAMember {
	row_key: string;
	user_id: number;
	name: string;
	position: string;
	position_type: string;
	position_id: number;
	ranking: number;
	remarks: string;
	cut_status?: CutStatus | null;
	commitment_period?: CommitmentPeriod | null;
	attendance: number;
	performance: number;
	helpfulness: number;
	initiative: number;
	attitude: number;
}

export type PositionGroup = {
	position_id: number;
	position: string;
	position_type: string;
	members: CCAMember[];
};

export type RankingSavePayload = {
	user_id: number;
	position_id: number;
	ranking: number;
	attendance: number;
	performance: number;
	helpfulness: number;
	initiative: number;
	attitude: number;
	remarks: string;
};

export type ScoreField = "attendance" | "performance" | "helpfulness" | "initiative" | "attitude";

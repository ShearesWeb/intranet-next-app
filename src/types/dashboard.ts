import { CcaType, PositionType } from "./User";

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
  positions?: ManagedCcaPosition[];
  can_manage_members?: boolean;
  can_rank_members?: boolean;
}

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
  cca_type: 'sports' | 'culture';
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

export interface UserSearchResult {
  id: number;
  name: string;
  email: string;
  room?: string | null;
}

export type CutStatus = 'ivp-ihg-team' | 'ihg-team' | 'final-cut' | 'first-cut';
export type CommitmentPeriod = 'semester-1' | 'semester-2' | 'full-year';

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

export type PendingChangeType = 'add' | 'remove' | 'cut' | 'update_status' | 'update_commitment';

export interface PendingChange {
  type: PendingChangeType;
  user_id: number;
  user_name: string;
  user_email: string;
  user_room?: string;
  new_status?: CutStatus | null;
  new_commitment_period?: CommitmentPeriod;
  position_id?: number;
  position_name?: string;
}

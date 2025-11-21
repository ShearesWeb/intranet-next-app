export interface CCAData {
  name: string;
  role: string;
  position_type: string;
  cca_type: string;
  description: string;
  points: number;
}

export interface RankablePosition {
  id: number;
  name: string;
  cca_name: string;
  position_type: 'maincomm' | 'subcomm' | 'blockcomm';
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
  total_capacity: number;
  available_capacity: number;
  applied_count: number;
  position_type: string;
  applicants: Applicant[];
}

export interface UserSearchResult {
  id: number;
  name: string;
  email: string;
  room?: string | null;
}

export interface Member {
  user_id: number;
  name: string;
  email: string;
  room: string;
  position_name: string;
  position_type: string;
  points: number;
  appointed_date: string;
  cut?: boolean;
}

export type PendingChangeType = 'add' | 'remove' | 'cut';

export interface PendingChange {
  type: PendingChangeType;
  user_id: number;
  user_name: string;
  user_email: string;
  user_room?: string;
}

// Database schema types
export type SubsidyStatus = "pending" | "approved" | "rejected";

export interface SubsidyRow {
    id: number;
    position_id: number;
    week_id: number;
    hours: number;
    justification: string | null;
    subsidy_status: SubsidyStatus;
}

// Database row with joined CCA position data
export interface SubsidyWithPosition extends SubsidyRow {
    cca_positions?: {
        id: number;
        name: string;
        position_type: string;
        cca_id?: number;
    } | null;
}

// Application types - shared across dashboard and API
export interface PositionOption {
    id: number;
    name: string;
    position_type: string;
}

export interface WeekOption {
    id: number;
    label: string;
}

// Dashboard view model (ORIGINAL - UNCHANGED)
export interface SubsidyDeclaration {
    id: number;
    positionId: number;
    positionName: string;
    positionType: string;
    weekId: number;
    hours: number;
    justification: string;
    status: SubsidyStatus;
}

export interface DeclarationSection {
    key: SubsidyStatus;
    title: string;
    data: SubsidyDeclaration[];
}

// API-specific types with joined CCA data
export interface SubsidyWithCCAInfo extends SubsidyRow {
    cca_positions?: {
        id: number;
        name: string;
        position_type: string;
        cca_id: number;
        ccas?: {
            id: number;
            name: string;
        } | null;
    } | null;
}

// Extended type for approvals page (adds CCA information)
export interface SubsidyDeclarationWithCCA extends SubsidyDeclaration {
    ccaId: number;
    ccaName: string;
}

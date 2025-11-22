export type SubsidyStatus = "pending" | "approved" | "rejected" | "partial";

export type SubsidyDeclaration = {
    id: number;
    positionId: number;
    positionName: string;
    positionType: string;
    weekId: number;
    hours: number;
    justification: string;
    status: SubsidyStatus;
};

export type DeclarationSection = {
    key: SubsidyStatus;
    title: string;
    data: SubsidyDeclaration[];
};

export type PositionOption = {
    id: number;
    name: string;
    position_type: string;
};

export type SubsidyFromApi = {
    id: number;
    position_id: number;
    week_id: number;
    hours: number;
    reason: string | null;
    subsidy_status: SubsidyStatus;
    cca_positions?: {
        id: number;
        name: string;
        position_type: string;
    } | null;
};

export type WeekOption = {
    id: number;
    label: string;
};

// Re-export types from centralized location for backwards compatibility
export { SubsidyStatus } from "@/types/holiday-subsidy";
export type {
    SubsidyDeclaration,
    DeclarationSection,
    PositionOption,
    WeekOption,
    SubsidyWithPosition as SubsidyFromApi, // Alias for backwards compatibility
} from "@/types/holiday-subsidy";

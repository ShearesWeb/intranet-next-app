import { FacilityType } from "@/types/facilities";

/**
 * Whether chairs may see or claim slots of this venue type on the intranet.
 *
 * Historical non-Sheares rows remain valid data, but only Sheares facilities
 * are exposed as bookable by the application.
 */
export function isBookableFacilityType(type: FacilityType): boolean {
	return type === "sheares";
}

/** The venue types chairs may book, in catalog display order. */
export function bookableFacilityTypes(): FacilityType[] {
	return ["sheares"];
}

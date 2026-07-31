import { Facility, FacilityType, FACILITY_TYPE_CONFIG } from "@/types/facilities";

const TYPE_ORDER: FacilityType[] = ["sheares", "reboks", "nus", "external"];

export interface FacilityGroup {
	type: FacilityType;
	label: string;
	color: string;
	facilities: Facility[];
}

/**
 * Active facilities matching `query` (case-insensitive substring of venue or
 * sub_venue), grouped by type in catalog order. Empty groups are dropped.
 */
export function groupFacilitiesByType(facilities: Facility[], query: string): FacilityGroup[] {
	const q = query.trim().toLowerCase();
	const matches = facilities.filter((f) => {
		if (!f.active) return false;
		if (!q) return true;
		return `${f.venue} ${f.sub_venue}`.toLowerCase().includes(q);
	});

	const groups: FacilityGroup[] = [];
	for (const type of TYPE_ORDER) {
		const list = matches.filter((f) => f.type === type);
		if (list.length === 0) continue;
		const cfg = FACILITY_TYPE_CONFIG[type];
		groups.push({ type, label: cfg.label, color: cfg.color, facilities: list });
	}
	return groups;
}

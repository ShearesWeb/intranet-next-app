import { describe, expect, it } from "vitest";
import { groupFacilitiesByType } from "./facility-picker";
import type { Facility } from "@/types/facilities";

const FACILITIES: Facility[] = [
	{ id: 1, venue: "Sheares Hall", sub_venue: "Multi-Purpose Hall", type: "sheares", active: true },
	{ id: 2, venue: "Kent Ridge", sub_venue: "Tennis Court 1", type: "reboks", active: true },
	{ id: 3, venue: "Kent Ridge", sub_venue: "Squash Court 2", type: "reboks", active: true },
	{ id: 4, venue: "Old Gym", sub_venue: "Disused Court", type: "reboks", active: false },
];

describe("groupFacilitiesByType", () => {
	it("groups active facilities by type in catalog order, dropping empty groups", () => {
		const groups = groupFacilitiesByType(FACILITIES, "");
		expect(groups.map((g) => g.type)).toEqual(["sheares", "reboks"]);
		expect(groups[1].facilities.map((f) => f.id)).toEqual([2, 3]); // inactive (4) excluded
	});

	it("filters by a case-insensitive substring of venue or sub_venue", () => {
		const groups = groupFacilitiesByType(FACILITIES, "tennis");
		expect(groups).toHaveLength(1);
		expect(groups[0].type).toBe("reboks");
		expect(groups[0].facilities.map((f) => f.id)).toEqual([2]);
	});

	it("returns no groups when nothing matches", () => {
		expect(groupFacilitiesByType(FACILITIES, "zzz")).toEqual([]);
	});
});

import { describe, expect, it } from "vitest";
import { groupFacilitiesByType } from "./facility-picker";
import type { Facility } from "@/types/facilities";

const FACILITIES: Facility[] = [
	{ id: 1, venue: "Sheares Hall", sub_venue: "Multi-Purpose Hall", type: "sheares" },
	{ id: 2, venue: "Kent Ridge", sub_venue: "Tennis Court 1", type: "reboks" },
	{ id: 3, venue: "Kent Ridge", sub_venue: "Squash Court 2", type: "reboks" },
];

describe("groupFacilitiesByType", () => {
	it("groups only Sheares facilities", () => {
		const groups = groupFacilitiesByType(FACILITIES, "");
		expect(groups.map((g) => g.type)).toEqual(["sheares"]);
		expect(groups[0].facilities.map((f) => f.id)).toEqual([1]);
	});

	it("filters by a case-insensitive substring of venue or sub_venue", () => {
		const groups = groupFacilitiesByType(FACILITIES, "multi-purpose");
		expect(groups).toHaveLength(1);
		expect(groups[0].type).toBe("sheares");
		expect(groups[0].facilities.map((f) => f.id)).toEqual([1]);
	});

	it("does not expose non-Sheares matches", () => {
		expect(groupFacilitiesByType(FACILITIES, "tennis")).toEqual([]);
	});

	it("returns no groups when nothing matches", () => {
		expect(groupFacilitiesByType(FACILITIES, "zzz")).toEqual([]);
	});
});

import { describe, expect, it } from "vitest";
import {
	CULTURE_STATUS_OPTIONS,
	SPORTS_STATUS_OPTIONS,
	formatCutStatus,
	getGroupFromStatus,
	getStatusLabel,
} from "./cut-status";

describe("cut-status vocabulary", () => {
	it("maps statuses to group keys, defaulting to members", () => {
		expect(getGroupFromStatus("ivp-ihg-team")).toBe("ivpIhgTeam");
		expect(getGroupFromStatus("first-cut")).toBe("firstCut");
		expect(getGroupFromStatus(null)).toBe("members");
		expect(getGroupFromStatus(undefined)).toBe("members");
	});

	it("maps statuses to group labels, defaulting to Members", () => {
		expect(getStatusLabel("ihg-team")).toBe("Final Cut - IHG Team Members");
		expect(getStatusLabel(null)).toBe("Members");
	});

	it("formats compact labels and tolerates raw DB casing", () => {
		expect(formatCutStatus("ivp-ihg-team")).toBe("IVP & IHG Team");
		expect(formatCutStatus("IHG_TEAM")).toBe("IHG Team Only");
		expect(formatCutStatus("  final cut ")).toBe("Final Cut");
		expect(formatCutStatus("unknown-status")).toBe("unknown-status");
		expect(formatCutStatus("")).toBe("-");
		expect(formatCutStatus(null)).toBe("-");
	});

	it("splits action options by CCA type", () => {
		expect(SPORTS_STATUS_OPTIONS.map((o) => o.status)).toEqual([
			"ivp-ihg-team",
			"ihg-team",
			"final-cut",
		]);
		expect(CULTURE_STATUS_OPTIONS).toEqual([{ status: "first-cut", label: "Promote to IVP" }]);
	});
});

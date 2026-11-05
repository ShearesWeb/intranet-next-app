import { describe, expect, it } from "vitest";
import {
	GRID_HOURS,
	GridClaim,
	clusterRequests,
	columnOfHour,
	columnRuns,
	facilityLabel,
	formatDayLabel,
	formatHourSpan,
	formatRequestedAgo,
	formatWeekRange,
	groupClaimSegments,
	isSlotPast,
	relativeDayLabel,
} from "@/lib/facilities/booking-grid";

function claim(id: number, hour: number, overrides: Partial<GridClaim> = {}): GridClaim {
	return {
		claim_id: id,
		facility_id: 1,
		date: "2026-11-05",
		hour,
		cca_id: 7,
		cca_name: "Netball",
		status: "pending",
		...overrides,
	};
}

describe("booking grid hours", () => {
	it("runs the booking day from 8 AM through to 2 AM", () => {
		expect(GRID_HOURS[0]).toBe(8);
		expect(GRID_HOURS[GRID_HOURS.length - 1]).toBe(1);
		expect(columnOfHour(0)).toBe(16);
		expect(columnOfHour(5)).toBe(-1);
	});

	it("labels spans within and across periods", () => {
		expect(formatHourSpan(columnOfHour(18), columnOfHour(21))).toBe("6–9 PM");
		expect(formatHourSpan(columnOfHour(11), columnOfHour(13))).toBe("11 AM – 1 PM");
		expect(formatHourSpan(columnOfHour(23), columnOfHour(1) + 1)).toBe("11 PM – 2 AM");
		expect(formatHourSpan(columnOfHour(0), columnOfHour(1) + 1)).toBe("12–2 AM");
	});
});

describe("date labels", () => {
	it("formats days and week ranges", () => {
		expect(formatDayLabel("2026-11-04")).toBe("Wed 4 Nov");
		expect(formatWeekRange("2026-11-02", "2026-11-08")).toBe("2 – 8 Nov");
		expect(formatWeekRange("2026-10-26", "2026-11-01")).toBe("26 Oct – 1 Nov");
	});

	it("describes how far off a date is", () => {
		expect(relativeDayLabel("2026-11-04", "2026-11-04")).toBe("Today");
		expect(relativeDayLabel("2026-11-05", "2026-11-04")).toBe("Tomorrow");
		expect(relativeDayLabel("2026-11-09", "2026-11-04")).toBe("In 5 days");
	});

	it("counts request age in Singapore days", () => {
		// 17:00 UTC on the 3rd is already 1 AM on the 4th in Singapore.
		expect(formatRequestedAgo("2026-11-03T17:00:00Z", "2026-11-04")).toBe("Requested today");
		expect(formatRequestedAgo("2026-11-03T02:00:00Z", "2026-11-04")).toBe("Requested yesterday");
		expect(formatRequestedAgo("2026-11-01T02:00:00Z", "2026-11-04")).toBe("Requested 3 days ago");
		expect(formatRequestedAgo(null, "2026-11-04")).toBe("Requested");
	});
});

describe("facilityLabel", () => {
	it("avoids repeating a venue the sub-venue already names", () => {
		expect(facilityLabel({ venue: "MPSH", sub_venue: "Court 1" })).toBe("MPSH Court 1");
		expect(facilityLabel({ venue: "Band Room", sub_venue: "Band Room Main" })).toBe(
			"Band Room Main",
		);
		expect(facilityLabel({ venue: "Band Room", sub_venue: "" })).toBe("Band Room");
	});
});

describe("isSlotPast", () => {
	it("treats earlier dates as past and later dates as open", () => {
		expect(isSlotPast("2026-11-03", 17, "2026-11-04", 12)).toBe(true);
		expect(isSlotPast("2026-11-05", 0, "2026-11-04", 12)).toBe(false);
	});

	it("keeps the current hour bookable today", () => {
		const twoPm = columnOfHour(14);
		expect(isSlotPast("2026-11-04", twoPm - 1, "2026-11-04", 14)).toBe(true);
		expect(isSlotPast("2026-11-04", twoPm, "2026-11-04", 14)).toBe(false);
	});

	it("does not mark today past in the small hours, before the booking day begins", () => {
		expect(isSlotPast("2026-11-04", 0, "2026-11-04", 1)).toBe(false);
	});
});

describe("groupClaimSegments", () => {
	it("merges consecutive hours of one CCA into one booking", () => {
		const [segment, ...rest] = groupClaimSegments([claim(2, 19), claim(1, 18), claim(3, 20)]);
		expect(rest).toEqual([]);
		expect(formatHourSpan(segment.start, segment.end)).toBe("6–9 PM");
		expect(segment.claim_ids).toEqual([1, 2, 3]);
	});

	it("merges across midnight, which is consecutive on the grid", () => {
		const segments = groupClaimSegments([claim(1, 23), claim(2, 0)]);
		expect(segments).toHaveLength(1);
		expect(formatHourSpan(segments[0].start, segments[0].end)).toBe("11 PM – 1 AM");
	});

	it("keeps gaps, other CCAs, statuses, dates and venues apart", () => {
		expect(
			groupClaimSegments([
				claim(1, 18),
				claim(2, 20),
				claim(3, 19, { cca_id: 8 }),
				claim(4, 19, { status: "approved" }),
				claim(5, 19, { date: "2026-11-06" }),
				claim(6, 19, { facility_id: 2 }),
			]),
		).toHaveLength(6);
	});

	it("ignores hours outside the booking day", () => {
		expect(groupClaimSegments([claim(1, 4)])).toEqual([]);
	});
});

describe("clusterRequests", () => {
	it("groups overlapping requests into one conflict", () => {
		const clusters = clusterRequests(
			groupClaimSegments([
				claim(1, 13, { cca_id: 7 }),
				claim(2, 14, { cca_id: 7 }),
				claim(3, 14, { cca_id: 8 }),
				claim(4, 15, { cca_id: 8 }),
			]),
		);
		expect(clusters).toHaveLength(1);
		expect(clusters[0].items).toHaveLength(2);
		expect(formatHourSpan(clusters[0].start, clusters[0].end)).toBe("1–4 PM");
	});

	it("leaves back-to-back requests uncontested", () => {
		const clusters = clusterRequests(
			groupClaimSegments([claim(1, 13, { cca_id: 7 }), claim(2, 14, { cca_id: 8 })]),
		);
		expect(clusters.map((cluster) => cluster.items.length)).toEqual([1, 1]);
	});

	it("does not treat the same hour at another venue as a conflict", () => {
		const clusters = clusterRequests(
			groupClaimSegments([
				claim(1, 13, { cca_id: 7 }),
				claim(2, 13, { cca_id: 8, facility_id: 2 }),
			]),
		);
		expect(clusters.map((cluster) => cluster.items.length)).toEqual([1, 1]);
	});

	it("sorts by date, then time", () => {
		const clusters = clusterRequests(
			groupClaimSegments([
				claim(1, 18, { date: "2026-11-06" }),
				claim(2, 20, { facility_id: 2 }),
				claim(3, 10, { facility_id: 3 }),
			]),
		);
		expect(clusters.map((cluster) => cluster.date)).toEqual([
			"2026-11-05",
			"2026-11-05",
			"2026-11-06",
		]);
		expect(clusters[0].facility_id).toBe(3);
	});
});

describe("columnRuns", () => {
	it("collapses columns into consecutive runs", () => {
		expect(columnRuns([5, 1, 2, 3])).toEqual([
			[1, 4],
			[5, 6],
		]);
	});
});

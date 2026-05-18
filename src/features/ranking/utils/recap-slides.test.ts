import { describe, expect, it } from "vitest";

import { buildRecapSlides } from "@/features/ranking/utils/recap-slides";

const user = {
	id: 1,
	name: "Taylor Tan",
	email: "taylor@example.com",
	room: "A101",
	points: 99,
	is_admin: false,
	is_jcrc: false,
	is_culture_sports_admin: false,
	appointments: [
		{
			cca_id: 100,
			cca_name: "Block A",
			position_id: 100,
			position_name: "Resident",
			position_type: "resident",
			points: 7,
			commitment_period: "full-year" as const,
			cut_status: null,
		},
		{
			cca_id: 101,
			cca_name: "Block B",
			position_id: 101,
			position_name: "Member",
			position_type: "member",
			points: 22,
			commitment_period: "full-year" as const,
			cut_status: null,
		},
	],
};

const ccas = [
	{
		id: 1,
		name: "Choir",
		role: "Member",
		position_type: "member",
		cca_type: "culture",
		description: "",
		points: 10,
		cut_status: null,
	},
	{
		id: 2,
		name: "Basketball",
		role: "Captain",
		position_type: "lead",
		cca_type: "sports",
		description: "",
		points: 20,
		cut_status: "ihg-team" as const,
	},
	{
		id: 3,
		name: "Social Committee",
		role: "Chair",
		position_type: "lead",
		cca_type: "committee",
		description: "",
		points: 30,
		cut_status: null,
	},
	{
		id: 4,
		name: "Welfare Committee",
		role: "Member",
		position_type: "member",
		cca_type: "committee",
		description: "",
		points: 40,
		cut_status: null,
	},
	{
		id: 5,
		name: "Open House",
		role: "Volunteer",
		position_type: "member",
		cca_type: "supplementary",
		description: "",
		points: 5,
		cut_status: null,
	},
	{
		id: 6,
		name: "Night Cycling",
		role: "Participant",
		position_type: "member",
		cca_type: "adhoc",
		description: "",
		points: 2,
		cut_status: null,
	},
];

describe("buildRecapSlides", () => {
	it("returns the existing slide order", () => {
		const { slides } = buildRecapSlides(user, ccas);

		expect(slides.map((slide) => slide.id)).toEqual([
			"intro",
			"culture",
			"sports",
			"committees",
			"block",
			"supplementary",
			"adhoc",
			"reveal",
		]);
	});

	it("preserves cumulative totals across the category slides", () => {
		const { slides, totals } = buildRecapSlides(user, ccas);

		expect(totals).toMatchObject({
			totalPoints: 99,
			totalCcas: 6,
			culturePoints: 10,
			sportsPoints: 20,
			committeePoints: 30,
			blockPoints: 7,
			supplementaryPoints: 5,
			adhocPoints: 2,
		});

		expect(slides.find((slide) => slide.id === "culture")?.statValue).toBe("10");
		expect(slides.find((slide) => slide.id === "sports")?.statValue).toBe("30");
		expect(slides.find((slide) => slide.id === "committees")?.statValue).toBe("60");
		expect(slides.find((slide) => slide.id === "block")?.statValue).toBe("67");
		expect(slides.find((slide) => slide.id === "supplementary")?.statValue).toBe("72");
		expect(slides.find((slide) => slide.id === "adhoc")?.statValue).toBe("74");
	});

	it("excludes member and resident committee rows from the committee slide", () => {
		const { slides, totals } = buildRecapSlides(user, ccas);
		const committeeSlide = slides.find((slide) => slide.id === "committees");

		expect(committeeSlide?.bulletItems).toEqual(["Social Committee"]);
		expect(committeeSlide?.description).toContain("1 committee");
		expect(totals.committeePoints).toBe(30);
	});

	it("sources block recap points from resident appointments instead of CCA rows", () => {
		const { slides, totals } = buildRecapSlides(user, ccas);
		const blockSlide = slides.find((slide) => slide.id === "block");

		expect(blockSlide?.bulletItems).toEqual(["Block A"]);
		expect(blockSlide?.statNote).toContain("7 block point");
		expect(totals.blockPoints).toBe(7);
	});
});

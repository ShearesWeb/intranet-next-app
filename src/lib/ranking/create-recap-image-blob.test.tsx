import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRecapImageBlob } from "@/lib/ranking/create-recap-image-blob";

const originalCreateElement = document.createElement.bind(document);

type MockGradient = {
	addColorStop: ReturnType<typeof vi.fn>;
};

const createGradient = (): MockGradient => ({
	addColorStop: vi.fn(),
});

const fillText = vi.fn();

const mockContext = {
	scale: vi.fn(),
	beginPath: vi.fn(),
	moveTo: vi.fn(),
	arcTo: vi.fn(),
	closePath: vi.fn(),
	fillRect: vi.fn(),
	fill: vi.fn(),
	stroke: vi.fn(),
	fillText,
	measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
	createLinearGradient: vi.fn(createGradient),
	createRadialGradient: vi.fn(createGradient),
	lineTo: vi.fn(),
	shadowColor: "transparent",
	shadowBlur: 0,
	shadowOffsetY: 0,
	textAlign: "left" as CanvasTextAlign,
	fillStyle: "",
	font: "",
	strokeStyle: "",
	lineWidth: 0,
};

const mockCanvas = {
	width: 0,
	height: 0,
	getContext: vi.fn(() => mockContext),
	toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" }))),
};

const user = {
	id: 1,
	name: "Taylor Tan",
	email: "taylor@example.com",
	room: "A101",
	points: 99,
	is_jcrc: false,
	is_chair: false,
	stay_period: "full-year" as const,
	appointments: [
		{
			cca_id: 100,
			cca_name: "Block A",
			position_id: 100,
			position_name: "Resident",
			position_type: "resident" as const,
			cca_kind: "sports" as const,
			has_reports: false,
			points: 7,
			commitment_period: "full-year" as const,
			team_status: "none" as const,
		},
	],
};

const ccas = [
	{
		id: 1,
		name: "Choir",
		role: "Member",
		position_type: "member" as const,
		cca_kind: "culture" as const,
		description: "",
		points: 10,
		team_status: "none" as const,
	},
	{
		id: 2,
		name: "Basketball",
		role: "Captain",
		position_type: "lead" as const,
		cca_kind: "sports" as const,
		description: "",
		points: 20,
		team_status: "main-team" as const,
	},
	{
		id: 3,
		name: "Social Committee",
		role: "Chair",
		position_type: "lead" as const,
		cca_kind: "committee" as const,
		description: "",
		points: 30,
		team_status: "none" as const,
	},
	{
		id: 4,
		name: "Open House",
		role: "Volunteer",
		position_type: "member" as const,
		cca_kind: "supplementary" as const,
		description: "",
		points: 5,
		team_status: "none" as const,
	},
	{
		id: 5,
		name: "Night Cycling",
		role: "Participant",
		position_type: "member" as const,
		cca_kind: "adhoc" as const,
		description: "",
		points: 2,
		team_status: "none" as const,
	},
];

const recap = {
	slides: [],
	totals: {
		totalPoints: 99,
		totalCcas: 5,
		culturePoints: 10,
		sportsPoints: 20,
		committeePoints: 30,
		blockPoints: 7,
		supplementaryPoints: 5,
		adhocPoints: 2,
	},
};

describe("createRecapImageBlob", () => {
	beforeEach(() => {
		fillText.mockClear();
		mockCanvas.getContext.mockClear();
		mockCanvas.toBlob.mockClear();
		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			if (tagName === "canvas") {
				return mockCanvas as unknown as HTMLCanvasElement;
			}

			return originalCreateElement(tagName);
		});
	});

	it("creates a PNG blob without React state", async () => {
		const blob = await createRecapImageBlob(user, ccas, recap);

		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("image/png");
		expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", 0.92);
	});

	it("writes the export headings and category labels onto the canvas", async () => {
		await createRecapImageBlob(user, ccas, recap);

		const renderedText = fillText.mock.calls.map(([text]) => text);

		expect(renderedText).toEqual(
			expect.arrayContaining([
				"SHEARES WRAPPED",
				"25/26 HALL POINTS RECAP",
				"Culture",
				"Sports",
				"Committees",
				"Block",
				"Supplementary",
				"Adhoc",
			]),
		);
	});
});

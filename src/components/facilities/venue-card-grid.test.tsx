import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VenueCardGrid, compactHourRange } from "@/components/facilities/venue-card-grid";
import type { Facility, SlotWithContext } from "@/types/facilities";

function dateFromToday(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() + days);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

const OPEN_DATE = dateFromToday(10);

const FACILITIES: Facility[] = [
	{ id: 1, venue: "Sheares Hall", sub_venue: "Multi-Purpose Hall", type: "sheares" },
	{ id: 2, venue: "Sheares Hall", sub_venue: "Music Room", type: "sheares" },
];

function slot(overrides: Partial<SlotWithContext> = {}): SlotWithContext {
	return {
		facility_id: overrides.facility_id ?? 1,
		venue: overrides.venue ?? "Sheares Hall",
		sub_venue: overrides.sub_venue ?? "Multi-Purpose Hall",
		type: overrides.type ?? "sheares",
		date: overrides.date ?? OPEN_DATE,
		hour: overrides.hour ?? 18,
		status: overrides.status ?? "available",
		live_claims: overrides.live_claims ?? 0,
		claims: overrides.claims ?? [],
		user_cca_claim: overrides.user_cca_claim ?? null,
	};
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function render(props: Partial<Parameters<typeof VenueCardGrid>[0]> = {}) {
	act(() => {
		root.render(
			<VenueCardGrid
				date={props.date ?? OPEN_DATE}
				facilities={props.facilities ?? FACILITIES}
				slots={props.slots ?? []}
				isChair={props.isChair ?? true}
				loading={props.loading}
				onClaim={props.onClaim ?? (() => {})}
			/>,
		);
	});
}

describe("compactHourRange", () => {
	it("formats one-hour slots compactly", () => {
		expect(compactHourRange(18)).toBe("6–7 PM");
		expect(compactHourRange(11)).toBe("11–12 PM");
		expect(compactHourRange(23)).toBe("11–12 AM");
	});
});

describe("VenueCardGrid", () => {
	it("shows an empty state when the selected day has no scheduled facilities", () => {
		render({ facilities: [] });

		expect(container.textContent).toContain("No facilities available");
		expect(container.textContent).toContain("no bookable facility timeslots");
	});

	it("renders every facility with available and confirmed slots", () => {
		render({
			slots: [
				slot({ facility_id: 1, hour: 19 }),
				slot({ facility_id: 1, hour: 18 }),
				slot({
					facility_id: 2,
					hour: 20,
					status: "confirmed",
					claims: [
						{
							claim_id: 5,
							cca_id: 3,
							cca_name: "Volleyball",
							status: "approved",
							created_by: 42,
						},
					],
				}),
				slot({ facility_id: 2, hour: 21, status: "pending" }),
			],
		});

		expect(container.querySelectorAll("article")).toHaveLength(2);
		expect(container.textContent).toContain("Multi-Purpose Hall");
		expect(container.textContent).toContain("Music Room");
		expect(container.textContent).toContain("6–7 PM");
		expect(container.textContent).toContain("7–8 PM");
		expect(container.textContent).toContain("8–9 PM");
		expect(container.textContent).toContain("Volleyball");
		expect(container.textContent).not.toContain("9–10 PM");
		expect(container.textContent).not.toContain("Sheares Hall");
	});

	it("places midnight and early-morning slots after the evening slots", () => {
		render({
			facilities: [FACILITIES[0]],
			slots: [slot({ hour: 1 }), slot({ hour: 0 }), slot({ hour: 23 }), slot({ hour: 8 })],
		});

		const labels = [...container.querySelectorAll("article button")].map((button) =>
			button.textContent?.trim(),
		);
		expect(labels).toEqual(["8–9 AM", "11–12 AM", "12–1 AM", "1–2 AM"]);
	});

	it("opens the claim flow from an available time button", () => {
		const onClaim = vi.fn();
		const availableSlot = slot({ hour: 18 });
		render({ slots: [availableSlot], onClaim });

		const button = [...container.querySelectorAll("button")].find(
			(candidate) => candidate.textContent === "6–7 PM",
		);
		act(() => button?.click());

		expect(onClaim).toHaveBeenCalledWith(availableSlot);
	});

	it("renders available times as green bubbles with white text", () => {
		render({ slots: [slot()] });
		const button = [...container.querySelectorAll("button")].find(
			(candidate) => candidate.textContent === "6–7 PM",
		);

		expect(button?.className).toContain("rounded-full");
		expect(button?.className).toContain("bg-green-600");
		expect(button?.className).toContain("text-white");
	});

	it("shows residents a confirmed slot as a red bubble with the approved CCA", () => {
		render({
			isChair: false,
			slots: [
				slot({
					status: "confirmed",
					claims: [
						{
							claim_id: 5,
							cca_id: 3,
							cca_name: "Volleyball",
							status: "approved",
							created_by: 42,
						},
					],
				}),
			],
		});

		const bookedSlot = container.querySelector('[aria-label="6–7 PM booked by Volleyball"]');
		expect(bookedSlot).toBeTruthy();
		expect(bookedSlot?.className).toContain("bg-red-600");
		expect(bookedSlot?.className).toContain("text-white");
		expect(bookedSlot?.textContent).toContain("6–7 PM");
		expect(bookedSlot?.textContent).toContain("Volleyball");
	});

	it("allows a chair to claim a same-day slot", () => {
		const onClaim = vi.fn();
		const today = dateFromToday(0);
		const sameDaySlot = slot({ date: today });
		render({ date: today, slots: [sameDaySlot], onClaim });

		const button = [...container.querySelectorAll("button")].find(
			(candidate) => candidate.textContent === "6–7 PM",
		);
		expect(button?.disabled).toBe(false);
		act(() => button?.click());
		expect(onClaim).toHaveBeenCalledWith(sameDaySlot);
	});

	it("keeps past slots unbookable", () => {
		const yesterday = dateFromToday(-1);
		render({ date: yesterday, slots: [slot({ date: yesterday })] });

		const button = [...container.querySelectorAll("button")].find(
			(candidate) => candidate.textContent === "6–7 PM",
		);
		expect(button?.disabled).toBe(true);
		expect(button?.title).toBe("Past dates cannot be booked");
	});

	it("disables claiming for residents", () => {
		render({ slots: [slot()], isChair: false });

		expect(container.querySelector("button")?.disabled).toBe(true);
	});
});

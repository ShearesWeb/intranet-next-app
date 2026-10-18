import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	FacilityScheduleCard,
	SCHEDULE_DAYS,
	SCHEDULE_HOURS,
} from "@/components/facilities/facility-schedule-card";
import type { Facility, FacilitySchedule } from "@/types/facilities";

const FACILITY: Facility = {
	id: 4,
	venue: "Sheares Hall",
	sub_venue: "Comm Hall",
	type: "sheares",
};

function schedule(id: number, day: number, hour: number): FacilitySchedule {
	return {
		id,
		facility_id: FACILITY.id,
		day_of_week: day,
		hour,
		start_date: null,
		end_date: null,
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

function render(schedules: FacilitySchedule[], onSave = vi.fn().mockResolvedValue(undefined)) {
	act(() => {
		root.render(<FacilityScheduleCard facility={FACILITY} schedules={schedules} onSave={onSave} />);
	});
	return onSave;
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
	return [...container.querySelectorAll("button")].find(
		(button) => button.textContent?.trim() === text,
	);
}

describe("FacilityScheduleCard", () => {
	it("shows saved days and hours without a saved-automatically footer", () => {
		render([schedule(1, 1, 18), schedule(2, 2, 18)]);

		expect(container.textContent).toContain("Comm Hall");
		const switchThumb = container.querySelector('[role="switch"] span');
		expect(switchThumb?.className).toContain("left-0.5");
		expect(switchThumb?.className).toContain("translate-x-5");
		expect(buttonWithText("Mon")?.getAttribute("aria-pressed")).toBe("true");
		expect(buttonWithText("Tue")?.getAttribute("aria-pressed")).toBe("true");
		expect(buttonWithText("6PM")?.getAttribute("aria-pressed")).toBe("true");
		expect(container.textContent).not.toContain("Saved automatically");
	});

	it("offers timeslots from 8 AM through 1 AM in operating-day order", () => {
		render([]);

		const hourLabels = [
			...container.querySelectorAll('[aria-labelledby="facility-4-hours"] button'),
		]
			.map((button) => button.textContent?.trim())
			.filter((label) => label !== "Select all");

		expect(hourLabels).toEqual([
			"8AM",
			"9AM",
			"10AM",
			"11AM",
			"12PM",
			"1PM",
			"2PM",
			"3PM",
			"4PM",
			"5PM",
			"6PM",
			"7PM",
			"8PM",
			"9PM",
			"10PM",
			"11PM",
			"12AM",
			"1AM",
		]);
	});

	it("saves the shared day and hour grid when a day changes", async () => {
		const onSave = render([schedule(1, 1, 18), schedule(2, 2, 18)]);

		await act(async () => {
			buttonWithText("Wed")?.click();
		});

		expect(onSave).toHaveBeenCalledWith(4, [1, 2, 3], [18]);
	});

	it("hides a visible facility by clearing its shared schedule", async () => {
		const onSave = render([schedule(1, 1, 18)]);
		const visibilitySwitch = container.querySelector<HTMLButtonElement>('[role="switch"]');

		await act(async () => {
			visibilitySwitch?.click();
		});

		expect(onSave).toHaveBeenCalledWith(4, [], []);
	});

	it("enables a hidden facility with every day and timeslot selected", async () => {
		const onSave = render([]);
		const visibilitySwitch = container.querySelector<HTMLButtonElement>('[role="switch"]');
		expect(visibilitySwitch?.querySelector("span")?.className).toContain("translate-x-0");

		await act(async () => {
			visibilitySwitch?.click();
		});

		expect(onSave).toHaveBeenCalledWith(4, [...SCHEDULE_DAYS], SCHEDULE_HOURS);
	});
});

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrentWeekBar } from "@/components/facilities/current-week-bar";

const DATES = [
	"2026-10-05",
	"2026-10-06",
	"2026-10-07",
	"2026-10-08",
	"2026-10-09",
	"2026-10-10",
	"2026-10-11",
];

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

describe("CurrentWeekBar", () => {
	it("renders a static week title and exactly seven day buttons", () => {
		act(() => {
			root.render(
				<CurrentWeekBar
					weekNumber={8}
					dates={DATES}
					selectedDate="2026-10-08"
					onSelectDate={() => {}}
				/>,
			);
		});

		expect(container.querySelector("h2")?.textContent).toBe("Week 8");
		expect(container.querySelectorAll("button")).toHaveLength(7);
		expect(container.textContent).not.toContain("NUS WEEK");
		expect(container.textContent).not.toContain("Next");
		expect(container.textContent).not.toContain("Previous");
		expect(container.querySelector('[aria-current="date"]')?.textContent).toContain("8 Oct");
	});

	it("selects a date without offering week navigation", () => {
		const onSelectDate = vi.fn();

		act(() => {
			root.render(
				<CurrentWeekBar
					weekNumber={8}
					dates={DATES}
					selectedDate="2026-10-08"
					onSelectDate={onSelectDate}
				/>,
			);
		});

		const monday = [...container.querySelectorAll("button")].find((button) =>
			button.textContent?.includes("5 Oct"),
		);
		act(() => monday?.click());

		expect(onSelectDate).toHaveBeenCalledWith("2026-10-05");
	});
});

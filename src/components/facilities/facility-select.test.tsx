import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacilitySelect } from "@/components/facilities/facility-select";
import type { Facility } from "@/types/facilities";

const FACILITIES: Facility[] = [
	{ id: 1, venue: "Sheares Hall", sub_venue: "Multi-Purpose Hall", type: "sheares", active: true },
	{ id: 2, venue: "Kent Ridge", sub_venue: "Tennis Court 1", type: "reboks", active: true },
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

function buttonWithText(text: string): HTMLButtonElement | undefined {
	return [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as
		| HTMLButtonElement
		| undefined;
}

describe("FacilitySelect", () => {
	it("shows the placeholder when nothing is selected", () => {
		act(() =>
			root.render(<FacilitySelect facilities={FACILITIES} value={null} onChange={() => {}} />),
		);
		expect(container.textContent).toContain("Select facility");
		expect(container.querySelector("input")).toBeNull(); // closed: no search box
	});

	it("opens a search dropdown with type-grouped options", () => {
		act(() =>
			root.render(<FacilitySelect facilities={FACILITIES} value={null} onChange={() => {}} />),
		);
		act(() => buttonWithText("Select facility")!.click());
		expect(container.querySelector("input")).not.toBeNull();
		expect(container.textContent).toContain("Sheares");
		expect(container.textContent).toContain("Reboks");
		expect(container.textContent).toContain("Tennis Court 1");
	});

	it("calls onChange with the picked id and closes", () => {
		const onChange = vi.fn();
		act(() =>
			root.render(<FacilitySelect facilities={FACILITIES} value={null} onChange={onChange} />),
		);
		act(() => buttonWithText("Select facility")!.click());
		act(() => buttonWithText("Tennis Court 1")!.click());
		expect(onChange).toHaveBeenCalledWith(2);
		expect(container.querySelector("input")).toBeNull(); // closed again
	});

	it("shows the selected facility's name on the trigger", () => {
		act(() =>
			root.render(<FacilitySelect facilities={FACILITIES} value={2} onChange={() => {}} />),
		);
		expect(container.textContent).toContain("Tennis Court 1");
	});
});

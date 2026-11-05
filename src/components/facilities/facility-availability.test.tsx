import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacilityAvailability } from "@/components/facilities/facility-availability";
import { ApprovalsPayload } from "@/lib/facilities/request-view";
import { Facility, FacilitySchedule } from "@/types/facilities";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const NOW = new Date("2026-11-04T06:00:00Z");
const COURT: Facility = { id: 1, venue: "MPSH", sub_venue: "Court 1", type: "sheares" };
const BAND: Facility = { id: 2, venue: "Band Room", sub_venue: "Band Room", type: "sheares" };

function row(
	facilityId: number,
	day: number,
	hour: number,
	endDate: string | null = null,
): FacilitySchedule {
	return {
		id: facilityId * 1000 + day * 100 + hour,
		facility_id: facilityId,
		day_of_week: day,
		hour,
		start_date: null,
		end_date: endDate,
	};
}

// Monday 6–8 PM at the court.
const SCHEDULES = [row(1, 1, 18), row(1, 1, 19)];
// Monday 9 Nov falls on that hour.
const BOOKED: ApprovalsPayload = {
	pending: [],
	confirmed: [
		{
			slot: {
				facility_id: 1,
				venue: "MPSH",
				sub_venue: "Court 1",
				type: "sheares",
				date: "2026-11-09",
				hour: 18,
				status: "confirmed",
				live_claims: 1,
				claims: [],
			},
			cca_name: "Netball",
			chair_name: "Rachel",
			claim_id: 70,
			days_until_booking: 5,
		},
	],
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const fetchMock = vi.fn();
const onChanged = vi.fn();

function render(
	schedules: FacilitySchedule[] = SCHEDULES,
	approvals: ApprovalsPayload = { pending: [], confirmed: [] },
	facilities: Facility[] = [COURT, BAND],
) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<FacilityAvailability
				facilities={facilities}
				schedules={schedules}
				approvals={approvals}
				onChanged={onChanged}
			/>,
		);
	});
}

function button(label: string): HTMLButtonElement {
	const found = [...container!.querySelectorAll("button")].find(
		(candidate) =>
			candidate.getAttribute("aria-label") === label || candidate.textContent === label,
	);
	if (!found) throw new Error(`No button: ${label}`);
	return found;
}

async function click(target: HTMLElement) {
	await act(async () => {
		target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	});
}

describe("FacilityAvailability", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		vi.clearAllMocks();
		fetchMock.mockImplementation(
			async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
		);
		vi.stubGlobal("fetch", fetchMock);
		onChanged.mockResolvedValue(undefined);
	});

	afterEach(() => {
		if (root) act(() => root!.unmount());
		container?.remove();
		root = null;
		container = null;
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("shows the saved weekly pattern, with no unsaved bar", () => {
		render();
		expect(container!.textContent).toContain("Mon 6–8 PM");
		expect(button("Mon 6–7 PM").getAttribute("aria-pressed")).toBe("true");
		expect(button("Tue 6–7 PM").getAttribute("aria-pressed")).toBe("false");
		expect(container!.textContent).toContain("Saved. These hours repeat every week");
		expect(container!.textContent).not.toContain("Unsaved changes");
	});

	it("saves painted cells using DB weekday numbers", async () => {
		render();
		await click(button("Sun 8–9 AM"));
		expect(container!.textContent).toContain("Unsaved changes");
		expect(container!.textContent).toContain("+1 h");

		await click(button("Save changes"));

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("/api/facilities/schedules");
		expect(init.method).toBe("PUT");
		const body = JSON.parse(init.body);
		expect(body.facility_id).toBe(1);
		expect(body.cells).toEqual(
			expect.arrayContaining([
				{ day: 1, hour: 18 },
				{ day: 1, hour: 19 },
				{ day: 0, hour: 8 },
			]),
		);
		expect(body.cancel_claim_ids).toEqual([]);
		expect(onChanged).toHaveBeenCalled();
	});

	it("drops the unsaved bar when a change is painted back", async () => {
		render();
		await click(button("Tue 6–7 PM"));
		await click(button("Tue 6–7 PM"));
		expect(container!.textContent).not.toContain("Unsaved changes");
	});

	it("lists the bookings a closure will cancel and sends exactly those", async () => {
		render(SCHEDULES, BOOKED);
		await click(button("Mon 6–7 PM"));

		expect(container!.textContent).toContain("Saving will cancel 1 booking");
		expect(container!.textContent).toContain("Netball · Mon 9 Nov · 6–7 PM (confirmed)");
		await click(button("Save and cancel 1"));
		expect(JSON.parse(fetchMock.mock.calls[0][1].body).cancel_claim_ids).toEqual([70]);
	});

	it("warns nobody when the closed hour has no booking", async () => {
		render(SCHEDULES, BOOKED);
		await click(button("Mon 7–8 PM"));
		expect(container!.textContent).not.toContain("Saving will cancel");
		expect(button("Save changes")).toBeTruthy();
	});

	it("discards a draft", async () => {
		render();
		await click(button("Tue 6–7 PM"));
		await click(button("Discard"));
		expect(button("Tue 6–7 PM").getAttribute("aria-pressed")).toBe("false");
	});

	it("keeps the draft when saving fails", async () => {
		fetchMock.mockImplementation(
			async () => new Response(JSON.stringify({ error: "Nope" }), { status: 500 }),
		);
		render();
		await click(button("Tue 6–7 PM"));
		await click(button("Save changes"));
		expect(toast.error).toHaveBeenCalledWith("Nope");
		expect(container!.textContent).toContain("Unsaved changes");
	});

	it("will not switch venue over unsaved changes", async () => {
		render();
		await click(button("Tue 6–7 PM"));
		await click(button("Band Room"));
		expect(toast.error).toHaveBeenCalledWith("Save or discard changes to MPSH Court 1 first");
		expect(container!.textContent).toContain("Unsaved changes");
	});

	it("fills then clears a day from its label", async () => {
		render();
		await click(button("Tue"));
		expect(button("Tue 8–9 AM").getAttribute("aria-pressed")).toBe("true");
		await click(button("Tue"));
		expect(button("Tue 8–9 AM").getAttribute("aria-pressed")).toBe("false");
	});

	it("copies Monday across the weekdays only", async () => {
		render();
		await click(button("Copy Mon to weekdays"));
		expect(button("Fri 6–7 PM").getAttribute("aria-pressed")).toBe("true");
		expect(button("Sat 6–7 PM").getAttribute("aria-pressed")).toBe("false");
	});

	it("hides a venue without changing its hours", async () => {
		render();
		await click(button("Open MPSH Court 1 for booking"));
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("/api/facilities/schedules");
		expect(init.method).toBe("PATCH");
		expect(JSON.parse(init.body)).toEqual({ facility_id: 1, visible: false });
	});

	it("shows a hidden venue's hours and offers to reopen it", async () => {
		render([row(1, 1, 18, "2026-11-03")]);
		expect(container!.textContent).toContain("Hidden from Book");
		expect(button("Mon 6–7 PM").getAttribute("aria-pressed")).toBe("true");
		await click(button("Open MPSH Court 1 for booking"));
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ facility_id: 1, visible: true });
	});

	it("asks for hours before opening a venue that has none", async () => {
		render([], { pending: [], confirmed: [] }, [COURT]);
		await click(button("Open MPSH Court 1 for booking"));
		expect(fetchMock).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith("Paint and save hours for MPSH Court 1 first");
	});
});

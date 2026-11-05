import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyBookings } from "@/components/facilities/my-bookings";
import { type MyClaim } from "@/hooks/use-my-facility-claims";
import { FacilitySlot } from "@/types/facilities";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = new Date("2026-11-04T06:00:00Z"); // Wed 4 Nov, 2 PM in Singapore

function claim(id: number, hour: number, overrides: Partial<MyClaim> = {}): MyClaim {
	return {
		claim_id: id,
		facility_id: 1,
		date: "2026-11-05",
		hour,
		cca_id: 7,
		cca_name: "Netball",
		status: "pending",
		venue: "MPSH",
		sub_venue: "Court 1",
		...overrides,
	};
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const fetchMock = vi.fn();
const onChanged = vi.fn();
const onViewOnGrid = vi.fn();

function render(claims: MyClaim[], slots: FacilitySlot[] = []) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<MyBookings
				claims={claims}
				slots={slots}
				chairCcas={[
					{ id: 7, name: "Netball" },
					{ id: 8, name: "Web" },
				]}
				loading={false}
				gridDates={new Set(["2026-11-05", "2026-11-03"])}
				onViewOnGrid={onViewOnGrid}
				onChanged={onChanged}
			/>,
		);
	});
}

function button(text: string): HTMLButtonElement {
	const found = [...container!.querySelectorAll("button")].find((candidate) =>
		candidate.textContent?.includes(text),
	);
	if (!found) throw new Error(`No button: ${text}`);
	return found;
}

async function click(target: HTMLElement) {
	await act(async () => {
		target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	});
}

describe("MyBookings", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		vi.clearAllMocks();
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
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

	it("merges hourly claims into one row", () => {
		render([claim(1, 18), claim(2, 19), claim(3, 20)]);
		expect(container!.textContent).toContain("MPSH Court 1");
		expect(container!.textContent).toContain("6–9 PM · Netball");
		expect(container!.querySelectorAll('button[aria-expanded="false"]')).toHaveLength(1);
	});

	it("leaves out requests from before this week", () => {
		render([claim(1, 18, { date: "2026-10-20" })]);
		expect(container!.textContent).toContain("No requests yet");
	});

	it("counts by status and filters when a status is tapped", async () => {
		render([
			claim(1, 18),
			claim(2, 10, { status: "approved" }),
			claim(3, 12, { status: "rejected" }),
		]);
		const stat = (label: string) =>
			[...container!.querySelectorAll<HTMLButtonElement>("aside button[aria-pressed]")].find(
				(candidate) => candidate.textContent?.startsWith(label),
			)!;
		expect(stat("Upcoming").textContent).toBe("Upcoming1");
		expect(stat("Pending").textContent).toBe("Pending1");
		expect(stat("Declined").textContent).toBe("Declined1");

		await click(stat("Declined"));
		expect(container!.querySelectorAll("button[aria-expanded]")).toHaveLength(1);
		expect(container!.textContent).toContain("JCRC declined this request");

		await click(button("Show all"));
		expect(container!.querySelectorAll("button[aria-expanded]")).toHaveLength(3);
	});

	it("filters by CCA when the chair has several", async () => {
		render([claim(1, 18), claim(2, 10, { cca_id: 8, cca_name: "Web" })]);
		await click(button("Web"));
		expect(container!.querySelectorAll("button[aria-expanded]")).toHaveLength(1);
		expect(container!.textContent).toContain("Web");
	});

	it("notes competing CCAs and bookings given to someone else", () => {
		const slots = [
			{
				facility_id: 1,
				date: "2026-11-05",
				hour: 18,
				claims: [{ claim_id: 9, cca_id: 9, cca_name: "Floorball", status: "pending" }],
			},
			{
				facility_id: 1,
				date: "2026-11-05",
				hour: 10,
				claims: [{ claim_id: 10, cca_id: 9, cca_name: "Floorball", status: "approved" }],
			},
		] as unknown as FacilitySlot[];
		render([claim(1, 18), claim(2, 10, { status: "rejected" })], slots);
		expect(container!.textContent).toContain("1 other CCA also asked for this time");
		expect(container!.textContent).toContain("JCRC gave this slot to another CCA");
	});

	it("withdraws the whole request after confirming", async () => {
		render([claim(1, 18), claim(2, 19)]);
		await click(button("6–8 PM"));
		await click(button("Withdraw request"));
		expect(container!.textContent).toContain("JCRC won't see it any more");
		await click(button("Yes, withdraw"));

		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ claim_ids: [1, 2] });
		expect(onChanged).toHaveBeenCalled();
	});

	it("does not offer to cancel a booking that has passed", async () => {
		render([claim(1, 10, { date: "2026-11-03", status: "approved" })]);
		await click(button("10–11 AM"));
		expect(container!.textContent).toContain("View on grid");
		expect(container!.textContent).not.toContain("Cancel booking");
	});

	it("jumps to the grid", async () => {
		render([claim(1, 18)]);
		await click(button("6–7 PM"));
		await click(button("View on grid"));
		expect(onViewOnGrid).toHaveBeenCalledWith("2026-11-05");
	});
});

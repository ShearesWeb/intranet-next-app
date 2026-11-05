import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookCalendar } from "@/components/facilities/book-calendar";
import { getBookingWeeks } from "@/lib/nus-academic-calendar";
import { SlotClaim, FacilitySlot } from "@/types/facilities";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const NOW = new Date("2026-11-04T06:00:00Z"); // Wed 4 Nov, 2 PM in Singapore
const TOMORROW = "2026-11-05";
const COURT = { id: 1, venue: "MPSH", sub_venue: "Court 1", type: "sheares" as const };
const NETBALL = { id: 7, name: "Netball" };

function slot(hour: number, claims: Partial<SlotClaim>[] = []): FacilitySlot {
	return {
		facility_id: 1,
		venue: "MPSH",
		sub_venue: "Court 1",
		type: "sheares",
		date: TOMORROW,
		hour,
		status: claims.length ? "pending" : "available",
		live_claims: claims.length,
		claims: claims.map((claim, index) => ({
			claim_id: hour * 10 + index,
			cca_id: 9,
			cca_name: "Floorball",
			status: "pending",
			created_by: 1,
			...claim,
		})),
	};
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const fetchMock = vi.fn();
const onChanged = vi.fn();

function render(props: Partial<React.ComponentProps<typeof BookCalendar>> = {}) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<BookCalendar
				weeks={getBookingWeeks()}
				weekIndex={0}
				day={TOMORROW}
				onWeekChange={vi.fn()}
				onDayChange={vi.fn()}
				facilities={[COURT]}
				slots={[slot(18), slot(19), slot(20)]}
				myClaims={[]}
				bookingCcas={[NETBALL]}
				isJcrc={false}
				userReady
				onChanged={onChanged}
				{...props}
			/>,
		);
	});
	return container;
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

describe("BookCalendar", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		vi.clearAllMocks();
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 201 }));
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

	it("shows the current week and only the published hours as bookable", () => {
		render();
		expect(container!.textContent).toContain("Week 12 · this week");
		expect(container!.textContent).toContain("2 – 8 Nov");
		expect(container!.textContent).toContain("TODAY");
		expect(button("Request MPSH Court 1, 6–7 PM").disabled).toBe(false);
		expect(button("MPSH Court 1, 5–6 PM, not open").disabled).toBe(true);
	});

	it("sends every selected hour as one request", async () => {
		render();
		await click(button("Request MPSH Court 1, 6–7 PM"));
		expect(container!.textContent).toContain("New request");
		await click(button("End later"));
		await click(button("End later"));
		expect(container!.textContent).toContain("3 hours");
		// 9 PM is not published, so the selection cannot grow past it.
		expect(button("End later").disabled).toBe(true);

		await click(button("Send request"));

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("/api/facilities/claims");
		expect(JSON.parse(init.body)).toEqual({
			facility_id: 1,
			date: TOMORROW,
			hours: [18, 19, 20],
			cca_id: 7,
		});
		expect(onChanged).toHaveBeenCalled();
		expect(container!.textContent).not.toContain("New request");
	});

	it("keeps the selection when a request is refused", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ error: "Part of that time is not open" }), { status: 400 }),
		);
		render();
		await click(button("Request MPSH Court 1, 6–7 PM"));
		await click(button("Send request"));
		expect(toast.error).toHaveBeenCalledWith("Part of that time is not open");
		expect(container!.textContent).toContain("New request");
	});

	it("warns about other CCAs' requests but still lets a chair send", async () => {
		render({ slots: [slot(18, [{}])] });
		expect(container!.textContent).toContain("1 request");
		await click(button("Request MPSH Court 1, 6–7 PM"));
		expect(container!.textContent).toContain(
			"Floorball also asked for 6–7 PM. You can still send yours and JCRC will pick one.",
		);
	});

	it("asks which CCA only when the chair has several", async () => {
		render({ bookingCcas: [NETBALL, { id: 8, name: "Web" }] });
		await click(button("Request MPSH Court 1, 6–7 PM"));
		await click(button("Web"));
		await click(button("Send request"));
		expect(JSON.parse(fetchMock.mock.calls[0][1].body).cca_id).toBe(8);
	});

	it("blocks hours another CCA has confirmed, shown as locked", () => {
		render({
			slots: [slot(18, [{ status: "approved" }]), slot(19, [{ status: "approved" }])],
		});
		expect(container!.textContent).toContain("Floorball");
		expect(container!.textContent).toContain("6–8 PM · Booked");
		expect(button("MPSH Court 1, 6–7 PM, unavailable").disabled).toBe(true);
	});

	it("does not offer past hours today", () => {
		render({
			day: "2026-11-04",
			slots: [
				{ ...slot(13), date: "2026-11-04" },
				{ ...slot(14), date: "2026-11-04" },
			],
		});
		expect(button("MPSH Court 1, 1–2 PM, unavailable").disabled).toBe(true);
		expect(button("Request MPSH Court 1, 2–3 PM").disabled).toBe(false);
	});

	it("withdraws a whole pending request after confirming", async () => {
		render({
			slots: [
				slot(18, [{ claim_id: 50, cca_id: 7, cca_name: "Netball" }]),
				slot(19, [{ claim_id: 51, cca_id: 7, cca_name: "Netball" }]),
			],
		});
		await click(container!.querySelector<HTMLButtonElement>('button[title="Click to manage"]')!);
		expect(container!.textContent).toContain("Your request");
		await click(button("Withdraw request"));
		await click(button("Yes, withdraw"));

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("/api/facilities/claims");
		expect(init.method).toBe("DELETE");
		expect(JSON.parse(init.body)).toEqual({ claim_ids: [50, 51] });
		expect(onChanged).toHaveBeenCalled();
	});

	it("shows a declined request without offering to cancel it", async () => {
		render({
			myClaims: [
				{
					claim_id: 60,
					facility_id: 1,
					date: TOMORROW,
					hour: 18,
					cca_id: 7,
					cca_name: "Netball",
					status: "rejected",
					venue: "MPSH",
					sub_venue: "Court 1",
				},
			],
		});
		await click(container!.querySelector<HTMLButtonElement>('button[title="Click to manage"]')!);
		expect(container!.textContent).toContain("JCRC declined this request");
		expect(container!.textContent).not.toContain("Withdraw request");
	});

	it("gives residents a read-only grid and tells them who can book", () => {
		render({ bookingCcas: [] });
		expect(container!.textContent).toContain("Need a venue?");
		expect(button("MPSH Court 1, 6–7 PM, unavailable").disabled).toBe(true);
	});

	it("points JCRC-only members to the review queue", () => {
		render({ bookingCcas: [], isJcrc: true });
		expect(container!.textContent).toContain("Reviewing as JCRC");
		expect(container!.querySelector('a[href="/dashboard/facilities/admin"]')).not.toBeNull();
	});

	it("clears the selection on Escape", async () => {
		render();
		await click(button("Request MPSH Court 1, 6–7 PM"));
		await act(async () => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		});
		expect(container!.textContent).not.toContain("New request");
	});
});

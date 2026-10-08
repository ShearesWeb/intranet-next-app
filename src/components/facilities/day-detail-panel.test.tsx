import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DayDetailPanel } from "@/components/facilities/day-detail-panel";
import { SLOT_STATUS_CONFIG, type SlotWithContext } from "@/types/facilities";

/** Local YYYY-MM-DD, n days from today — the panel's lock logic compares against real time. */
function dateFromToday(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() + n);
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${m}-${day}`;
}

const OPEN_DATE = dateFromToday(10);
const LOCKED_DATE = dateFromToday(1);

function booking(p: Partial<SlotWithContext>): SlotWithContext {
	return {
		facility_id: p.facility_id ?? 1,
		venue: p.venue ?? "Sheares Hall",
		sub_venue: p.sub_venue ?? "MPSH",
		type: p.type ?? "sheares",
		date: p.date ?? OPEN_DATE,
		hour: p.hour ?? 18,
		status: p.status ?? "available",
		live_claims: p.live_claims ?? p.claims?.length ?? 0,
		claims: p.claims ?? [],
		user_cca_claim: p.user_cca_claim ?? null,
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

function render(props: Partial<Parameters<typeof DayDetailPanel>[0]> = {}) {
	act(() =>
		root.render(
			<DayDetailPanel
				date={props.date ?? OPEN_DATE}
				bookings={props.bookings ?? []}
				isChair={props.isChair ?? false}
				onClaim={props.onClaim ?? (() => {})}
				onWithdraw={props.onWithdraw}
				loading={props.loading}
			/>,
		),
	);
}

describe("DayDetailPanel", () => {
	it("caps visible rows at 10 with pagination", () => {
		const bookings = Array.from({ length: 25 }, (_, i) =>
			booking({ sub_venue: `Court ${i + 1}`, hour: 8 + (i % 15) }),
		);
		render({ bookings });

		expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
		expect(container.textContent).toContain("Page 1 of 3");
	});

	it("renders a search input that filters rows by venue", () => {
		const bookings = [
			booking({ hour: 18, sub_venue: "Band Room", venue: "Sheares Hall" }),
			booking({ hour: 19, sub_venue: "Tennis Court 1", venue: "REBOKS" }),
			booking({ hour: 20, sub_venue: "Tennis Court 2", venue: "REBOKS" }),
		];
		render({ bookings });

		const input = container.querySelector("input[placeholder*='venue' i]") as HTMLInputElement;
		expect(input).toBeTruthy();

		act(() => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				"value",
			)!.set!;
			setter.call(input, "tennis");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});

		const rows = [...container.querySelectorAll("tbody tr")];
		expect(rows).toHaveLength(2);
		expect(rows[0].textContent).toContain("Tennis Court 1");
	});

	it("renders the Available badge in green", () => {
		expect(SLOT_STATUS_CONFIG.available.color).toBe("#10b981");

		render({ bookings: [booking({ hour: 18, status: "available" })] });
		const badge = [...container.querySelectorAll("tbody span")].find(
			(el) => el.textContent === "Available",
		) as HTMLElement;
		expect(badge).toBeTruthy();
		expect(["#10b981", "rgb(16, 185, 129)"]).toContain(badge.style.color);
	});

	it("keeps Confirmed distinct from Available (not green)", () => {
		expect(SLOT_STATUS_CONFIG.confirmed.color).not.toBe(SLOT_STATUS_CONFIG.available.color);
	});

	it("shows Claim button for chairs on available slots", () => {
		render({ bookings: [booking({ hour: 18, status: "available" })], isChair: true });
		const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Claim");
		expect(btn).toBeTruthy();
	});

	it("hides the Claim button and shows the lock note inside the 3-day window", () => {
		render({
			date: LOCKED_DATE,
			bookings: [booking({ hour: 18, status: "available", date: LOCKED_DATE })],
			isChair: true,
		});
		const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Claim");
		expect(btn).toBeFalsy();
		expect(container.textContent).toContain("Bookings lock");
	});

	it("still offers Withdraw on a locked day for the chair's own claim", () => {
		render({
			date: LOCKED_DATE,
			bookings: [
				booking({
					status: "pending",
					date: LOCKED_DATE,
					user_cca_claim: {
						claim_id: 9,
						cca_id: 3,
						cca_name: "Volleyball",
						status: "pending",
						created_by: 42,
					},
				}),
			],
			isChair: true,
			onWithdraw: () => {},
		});
		const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Withdraw");
		expect(btn).toBeTruthy();
	});
});

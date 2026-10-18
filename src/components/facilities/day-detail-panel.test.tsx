import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DayDetailPanel } from "@/components/facilities/day-detail-panel";
import { SLOT_STATUS_CONFIG, type SlotWithContext } from "@/types/facilities";

function dateFromToday(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() + n);
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${m}-${day}`;
}

const OPEN_DATE = dateFromToday(10);
const NEAR_DATE = dateFromToday(1);

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

	it("does not render the removed date heading or venue search", () => {
		render({ bookings: [booking({ sub_venue: "Band Room" })] });

		expect(container.querySelector("input[placeholder*='venue' i]")).toBeNull();
		expect(container.querySelector("h3")).toBeNull();
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

	it("allows chairs to claim inside the former 3-day lock window", () => {
		render({
			bookings: [booking({ hour: 18, status: "available", date: NEAR_DATE })],
			isChair: true,
		});
		const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Claim");
		expect(btn).toBeTruthy();
		expect(container.textContent).not.toContain("Bookings lock");
	});

	it("offers Withdraw for the chair's own claim", () => {
		render({
			bookings: [
				booking({
					status: "pending",
					date: NEAR_DATE,
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

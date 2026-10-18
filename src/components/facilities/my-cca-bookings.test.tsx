import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/lib/auth/auth-context";
import { MyCcaBookings } from "@/components/facilities/my-cca-bookings";

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: vi.fn() }));

const CHAIR_USER = {
	id: 1,
	appointments: [
		{
			cca_id: 7,
			cca_name: "Band",
			position_type: "lead",
		},
	],
};

const CLAIMS = [
	{
		id: 3,
		facility_id: 12,
		date: "2026-10-25",
		hour: 20,
		cca_id: 7,
		cca_name: "Band",
		status: "rejected",
		venue: "Sheares Hall",
		sub_venue: "Seminar Room 1",
		facility_type: "sheares",
	},
	{
		id: 1,
		facility_id: 10,
		date: "2026-10-21",
		hour: 19,
		cca_id: 7,
		cca_name: "Band",
		status: "approved",
		venue: "Sheares Hall",
		sub_venue: "Multi-Purpose Hall",
		facility_type: "sheares",
	},
	{
		id: 4,
		facility_id: 13,
		date: "2026-10-25",
		hour: 19,
		cca_id: 7,
		cca_name: "Band",
		status: "approved",
		venue: "Sheares Hall",
		sub_venue: "Seminar Room 2",
		facility_type: "sheares",
	},
	{
		id: 2,
		facility_id: 11,
		date: "2026-10-23",
		hour: 18,
		cca_id: 7,
		cca_name: "Band",
		status: "pending",
		venue: "Sheares Hall",
		sub_venue: "Band Room",
		facility_type: "sheares",
	},
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	vi.mocked(useAuth).mockReturnValue({ user: CHAIR_USER } as never);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function renderWithClaims(claims: typeof CLAIMS) {
	const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: claims }) });
	vi.stubGlobal("fetch", fetchMock);

	await act(async () => {
		root.render(<MyCcaBookings />);
	});

	await vi.waitFor(() =>
		expect(container.textContent).toContain(claims[0]?.sub_venue ?? "No bookings"),
	);

	return fetchMock;
}

describe("MyCcaBookings", () => {
	it("shows every status together from the latest date and time to the earliest", async () => {
		await renderWithClaims(CLAIMS);

		expect(container.textContent).toContain("Date");
		expect(container.textContent).toContain("Time");
		expect(container.textContent).toContain("Location");
		expect(container.textContent).toContain("Booking CCA");
		expect(container.textContent).toContain("Band");
		expect(container.textContent).toContain("Status");
		expect(container.textContent).toContain("Approved");
		expect(container.textContent).toContain("Pending");
		expect(container.textContent).toContain("Rejected");

		const text = container.textContent ?? "";
		expect(text.indexOf("Seminar Room 1")).toBeLessThan(text.indexOf("Seminar Room 2"));
		expect(text.indexOf("Seminar Room 2")).toBeLessThan(text.indexOf("Band Room"));
		expect(text.indexOf("Band Room")).toBeLessThan(text.indexOf("Multi-Purpose Hall"));
	});

	it("does not render the removed calendar, status tabs, or withdrawal wording", async () => {
		await renderWithClaims(CLAIMS);

		expect(container.querySelector("[aria-pressed]")).toBeNull();
		expect(container.querySelector("[role='tablist']")).toBeNull();
		expect(container.textContent).not.toContain("Withdraw");
	});

	it("cancels pending and approved bookings through the claims endpoint", async () => {
		const fetchMock = await renderWithClaims(CLAIMS);
		const cancelButton = container.querySelector(
			'button[aria-label="Cancel Band Room booking"]',
		) as HTMLButtonElement;

		expect(cancelButton).toBeTruthy();
		expect(
			container.querySelector('button[aria-label="Cancel Seminar Room 1 booking"]'),
		).toBeNull();

		await act(async () => {
			cancelButton.click();
		});

		await vi.waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith("/api/facilities/claims/2", { method: "DELETE" }),
		);
	});

	it("shows a single empty state when there are no bookings", async () => {
		await renderWithClaims([]);

		expect(container.textContent).toContain("No bookings");
		expect(container.textContent).toContain("Slots you claim show up here.");
	});
});

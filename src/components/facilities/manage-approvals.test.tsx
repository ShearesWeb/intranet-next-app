import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManageApprovals } from "@/components/facilities/manage-approvals";

const COMM_HALL_SLOT = {
	facility_id: 1,
	venue: "Sheares Hall",
	sub_venue: "Comm Hall",
	type: "sheares" as const,
	date: "2026-10-18",
	hour: 21,
	status: "conflicted" as const,
	live_claims: 2,
	claims: [],
};

const APPROVALS = {
	pending: [
		{
			slot: COMM_HALL_SLOT,
			days_until_booking: 4,
			claimants: [
				{
					claim: {
						claim_id: 11,
						cca_id: 7,
						cca_name: "Band",
						status: "pending" as const,
						created_by: 30,
					},
					cca_name: "Band",
					chair_name: "Alex Tan",
					chair_telegram: "alex",
				},
				{
					claim: {
						claim_id: 12,
						cca_id: 8,
						cca_name: "Dance",
						status: "pending" as const,
						created_by: 31,
					},
					cca_name: "Dance",
					chair_name: "Jamie Lim",
					chair_telegram: "jamie",
				},
			],
		},
	],
	confirmed: [
		{
			slot: {
				...COMM_HALL_SLOT,
				facility_id: 2,
				sub_venue: "Multi-Purpose Hall",
				date: "2026-10-19",
				hour: 20,
				status: "confirmed" as const,
				live_claims: 1,
			},
			cca_name: "Basketball",
			claim_id: 21,
			days_until_booking: 5,
		},
	],
};

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
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function renderApprovals() {
	const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
		if (init?.method === "POST") {
			return { ok: true, json: async () => ({ data: null }) };
		}
		return { ok: true, json: async () => ({ data: APPROVALS }) };
	});
	vi.stubGlobal("fetch", fetchMock);

	await act(async () => {
		root.render(<ManageApprovals />);
	});
	await vi.waitFor(() => expect(container.textContent).toContain("Multi-Purpose Hall"));

	return fetchMock;
}

function postBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
	const [, init] = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")[
		callIndex
	] as [string, RequestInit];
	return JSON.parse(String(init.body));
}

describe("ManageApprovals", () => {
	it("shows pending and confirmed bookings in matching row layouts", async () => {
		await renderApprovals();

		expect(container.textContent).toContain("Awaiting approval");
		expect(container.textContent).toContain("Upcoming confirmed bookings");
		expect(container.textContent).toContain("Date");
		expect(container.textContent).toContain("Time");
		expect(container.textContent).toContain("Location");
		expect(container.textContent).toContain("Booking CCA");
		expect(container.textContent).toContain("Band");
		expect(container.textContent).toContain("Dance");
		expect(container.textContent).toContain("Basketball");
		expect(container.textContent).not.toContain("Reject all");
	});

	it("approves one CCA and includes every competing claim for the slot", async () => {
		const fetchMock = await renderApprovals();
		const approve = container.querySelector(
			'button[aria-label="Approve Band booking for Comm Hall"]',
		) as HTMLButtonElement;

		await act(async () => approve.click());
		await vi.waitFor(() =>
			expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1),
		);

		expect(postBody(fetchMock, 0)).toEqual({
			action: "approve",
			claim_id: 11,
			competing_claim_ids: [11, 12],
		});
	});

	it("denies only the selected CCA claim", async () => {
		const fetchMock = await renderApprovals();
		const deny = container.querySelector(
			'button[aria-label="Deny Dance booking for Comm Hall"]',
		) as HTMLButtonElement;

		await act(async () => deny.click());
		await vi.waitFor(() =>
			expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1),
		);

		expect(postBody(fetchMock, 0)).toEqual({ action: "reject", claim_id: 12 });
	});

	it("revokes a confirmed booking", async () => {
		const fetchMock = await renderApprovals();
		const revoke = container.querySelector(
			'button[aria-label="Revoke Basketball booking for Multi-Purpose Hall"]',
		) as HTMLButtonElement;

		await act(async () => revoke.click());
		await vi.waitFor(() =>
			expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1),
		);

		expect(postBody(fetchMock, 0)).toEqual({ action: "revoke", claim_id: 21 });
	});
});

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacilityRequests } from "@/components/facilities/facility-requests";
import { ApprovalsPayload } from "@/lib/facilities/request-view";
import { ConfirmedBookingView, SlotApprovalView } from "@/types/facilities";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = new Date("2026-11-04T06:00:00Z");

function slotFields(hour: number, date = "2026-11-05", facilityId = 1) {
	return {
		facility_id: facilityId,
		venue: "MPSH",
		sub_venue: facilityId === 1 ? "Court 1" : "Court 2",
		type: "sheares" as const,
		date,
		hour,
		status: "pending" as const,
		live_claims: 1,
		claims: [],
	};
}

function pending(
	hour: number,
	claimId: number,
	cca: { id: number; name: string },
	facilityId = 1,
): SlotApprovalView {
	return {
		slot: slotFields(hour, "2026-11-05", facilityId),
		claimants: [
			{
				claim: {
					claim_id: claimId,
					cca_id: cca.id,
					cca_name: cca.name,
					status: "pending",
					created_by: 1,
				},
				cca_name: cca.name,
				chair_name: `${cca.name} Chair`,
				chair_telegram: "chairhandle",
				requested_at: "2026-11-03T02:00:00Z",
			},
		],
	};
}

function confirmed(hour: number, claimId: number): ConfirmedBookingView {
	return {
		slot: { ...slotFields(hour), status: "confirmed" },
		cca_name: "Band",
		chair_name: "Clara",
		claim_id: claimId,
	};
}

const NETBALL = { id: 7, name: "Netball" };
const FLOORBALL = { id: 8, name: "Floorball" };

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const fetchMock = vi.fn();
const onChanged = vi.fn();

function render(approvals: ApprovalsPayload) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(<FacilityRequests approvals={approvals} onChanged={onChanged} />);
	});
}

function button(text: string): HTMLButtonElement {
	const found = [...container!.querySelectorAll("button")].find(
		(candidate) =>
			candidate.textContent?.includes(text) || candidate.getAttribute("aria-label") === text,
	);
	if (!found) throw new Error(`No button: ${text}`);
	return found;
}

async function click(target: HTMLElement) {
	await act(async () => {
		target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	});
}

function lastBody() {
	return JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
}

describe("FacilityRequests", () => {
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

	it("shows hourly claims as one request and approves all of them", async () => {
		render({ pending: [pending(18, 1, NETBALL), pending(19, 2, NETBALL)], confirmed: [] });
		expect(container!.textContent).toContain("To review · 1");
		expect(container!.textContent).toContain("Thu 5 Nov");
		expect(container!.textContent).toContain("Tomorrow");
		expect(container!.textContent).toContain("6–8 PM");
		expect(container!.textContent).toContain("Netball Chair · requested yesterday");

		await click(button("Approve Netball request"));
		expect(lastBody()).toMatchObject({
			action: "approve",
			claim_ids: [1, 2],
			competing_claim_ids: [],
		});
		expect(onChanged).toHaveBeenCalled();
	});

	it("declines a request", async () => {
		render({ pending: [pending(18, 1, NETBALL)], confirmed: [] });
		await click(button("Decline Netball request"));
		expect(lastBody()).toMatchObject({ action: "reject", claim_ids: [1] });
	});

	it("puts overlapping requests in a conflict card and declines the loser in full", async () => {
		render({
			pending: [
				pending(13, 1, NETBALL),
				pending(14, 2, NETBALL),
				pending(14, 3, FLOORBALL),
				pending(15, 4, FLOORBALL),
			],
			confirmed: [],
		});
		expect(container!.textContent).toContain("Conflict · 2 CCAs");
		expect(container!.textContent).toContain("1 conflict need a decision");
		expect(container!.textContent).toContain("Overlap 2–3 PM");
		expect(container!.textContent).toContain("Approving declines Floorball.");
		expect(container!.textContent).toContain("@chairhandle");
		expect(container!.textContent).not.toContain("uncontested");

		await click(button("Approve Netball"));
		expect(lastBody()).toMatchObject({
			action: "approve",
			claim_ids: [1, 2],
			competing_claim_ids: [3, 4],
		});
	});

	it("bulk-approves uncontested requests and leaves conflicts alone", async () => {
		render({
			pending: [
				pending(10, 1, NETBALL),
				pending(10, 2, FLOORBALL, 2),
				pending(14, 3, NETBALL),
				pending(14, 4, FLOORBALL),
			],
			confirmed: [],
		});
		await click(button("Approve 2 uncontested"));
		expect(lastBody().claim_ids.sort()).toEqual([1, 2]);
	});

	it("says when the queue is clear", () => {
		render({ pending: [], confirmed: [] });
		expect(container!.textContent).toContain("All caught up");
		expect(container!.textContent).toContain("No conflicts");
	});

	it("revokes a confirmed booking only after asking", async () => {
		render({ pending: [], confirmed: [confirmed(18, 5), confirmed(19, 6)] });
		await click(button("Upcoming confirmed · 1"));
		expect(container!.textContent).toContain("Clara");
		await click(button("Revoke Band booking"));
		expect(fetchMock).not.toHaveBeenCalled();
		expect(container!.textContent).toContain("Reopen this slot?");

		await click(button("Keep"));
		expect(container!.textContent).not.toContain("Reopen this slot?");

		await click(button("Revoke Band booking"));
		const confirmButton = [...container!.querySelectorAll("button")].find(
			(candidate) => candidate.textContent === "Revoke",
		)!;
		await click(confirmButton);
		expect(lastBody()).toMatchObject({ action: "revoke", claim_ids: [5, 6] });
	});
});

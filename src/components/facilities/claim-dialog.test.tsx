import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimDialog } from "@/components/facilities/claim-dialog";
import type { SlotWithContext } from "@/types/facilities";

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
		warning: vi.fn(),
	},
}));

const BOOKING: SlotWithContext = {
	facility_id: 12,
	venue: "Comm Hall",
	sub_venue: "Comm Hall",
	type: "sheares",
	date: "2026-10-18",
	hour: 9,
	status: "available",
	live_claims: 0,
	claims: [],
	user_cca_claim: null,
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

describe("ClaimDialog", () => {
	it("selects and submits the sole CCA when it loads after the first render", async () => {
		const onClose = vi.fn();
		const onSuccess = vi.fn();
		const fetchMock = vi
			.fn()
			.mockResolvedValue({ ok: true, json: async () => ({ data: { id: 99 } }) });
		vi.stubGlobal("fetch", fetchMock);

		act(() => {
			root.render(
				<ClaimDialog booking={BOOKING} chairCcas={[]} onClose={onClose} onSuccess={onSuccess} />,
			);
		});
		expect(document.body.textContent).not.toContain("Claim Facility Slot");

		act(() => {
			root.render(
				<ClaimDialog
					booking={BOOKING}
					chairCcas={[{ id: 7, name: "Sheares Hall" }]}
					onClose={onClose}
					onSuccess={onSuccess}
				/>,
			);
		});

		const claimButton = [...document.body.querySelectorAll("button")].find((button) =>
			button.textContent?.includes("Claim for Sheares Hall"),
		);
		expect(claimButton).toBeTruthy();
		expect(claimButton?.disabled).toBe(false);

		await act(async () => {
			claimButton?.click();
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/facilities/claims",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					facility_id: 12,
					date: "2026-10-18",
					hour: 9,
					cca_id: 7,
				}),
			}),
		);
		expect(onSuccess).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});
});

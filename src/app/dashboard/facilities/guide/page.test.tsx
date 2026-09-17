import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isReboksBookingEnabled: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({
	isReboksBookingEnabled: mocks.isReboksBookingEnabled,
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderGuide() {
	// The step copy is picked at module load, so the page must be imported
	// after the flag mock is set for this test.
	vi.resetModules();
	const { default: FacilitiesGuidePage } = await import("./page");
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(<FacilitiesGuidePage />);
	});
	return container.textContent ?? "";
}

describe("FacilitiesGuidePage step-1 copy", () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(() => {
		if (root) act(() => root!.unmount());
		container?.remove();
		root = null;
		container = null;
	});

	it("omits the Reboks bot sentence while REBOKS booking is parked", async () => {
		mocks.isReboksBookingEnabled.mockReturnValue(false);
		const text = await renderGuide();
		expect(text).toContain("1. Bookings are published");
		expect(text).toContain("Venues are added by JCRC and can repeat weekly");
		expect(text).not.toMatch(/reboks/i);
	});

	it("restores the Reboks bot sentence once the flag is on", async () => {
		mocks.isReboksBookingEnabled.mockReturnValue(true);
		const text = await renderGuide();
		expect(text).toContain("Reboks slots come from the Reboks bot");
	});
});

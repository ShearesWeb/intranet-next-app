import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderGuide() {
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
	afterEach(() => {
		if (root) act(() => root!.unmount());
		container?.remove();
		root = null;
		container = null;
	});

	it("describes the JCRC-managed Sheares booking flow", async () => {
		const text = await renderGuide();
		expect(text).toContain("1. Bookings are published");
		expect(text).toContain("Venues are added by JCRC and can repeat weekly");
		expect(text).not.toMatch(/reboks/i);
	});
});

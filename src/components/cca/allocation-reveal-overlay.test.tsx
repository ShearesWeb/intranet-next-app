import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AllocationRevealOverlay } from "./allocation-reveal-overlay";
import { buildAllocationReveal } from "@/lib/cca/allocation-reveal";
import type { CCAData } from "@/types/cca-data";

const VOLLEYBALL: CCAData = {
	id: 1,
	name: "Sheares Volleyball",
	role: "Training IC",
	position_type: "maincomm",
	cca_kind: "sports",
	description: "Hall team representing Sheares in the Inter-Hall Games.",
	points: 8,
};

function render(ccas: CCAData[], onClose = vi.fn()) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root: Root = createRoot(container);
	const reveal = buildAllocationReveal(ccas, "maincomm");

	act(() => {
		root.render(<AllocationRevealOverlay reveal={reveal} onClose={onClose} />);
	});

	return {
		onClose,
		text: () => document.body.textContent ?? "",
		unmount: () => {
			act(() => root.unmount());
			container.remove();
		},
	};
}

/** Press Enter on the envelope — the keyboard path to the same open the drag triggers. */
function openEnvelope() {
	const envelope = document.querySelector<HTMLElement>(
		'[aria-label="Open your allocation envelope"]',
	);
	expect(envelope).not.toBeNull();
	act(() => {
		envelope!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
	});
}

describe("AllocationRevealOverlay", () => {
	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = "";
	});

	it("holds the appointment back until the envelope is opened", () => {
		const view = render([VOLLEYBALL]);

		expect(view.text()).toContain("Your allocations are ready.");
		expect(view.text()).not.toContain("Training IC");

		view.unmount();
	});

	it("reveals the card through a pending placeholder, then offers the exits", () => {
		const view = render([VOLLEYBALL]);
		openEnvelope();

		// Placeholder first — the card has not resolved yet.
		act(() => vi.advanceTimersByTime(1300));
		expect(view.text()).toContain("Result");
		expect(view.text()).not.toContain("Training IC");

		act(() => vi.advanceTimersByTime(1600));
		expect(view.text()).toContain("Sheares Volleyball");
		expect(view.text()).toContain("Training IC");

		act(() => vi.advanceTimersByTime(1000));
		expect(view.text()).toContain("Continue to My CCAs");
		expect(view.text()).toContain("Replay");
		// The subcomm round is still ahead during the maincomm reveal.
		expect(view.text()).toContain("Subcomm round opens later soon.");

		view.unmount();
	});

	it("shows the consolation card when the round allocated nothing", () => {
		const view = render([]);
		openEnvelope();

		act(() => vi.advanceTimersByTime(3000));
		expect(view.text()).toContain("No allocations found.");
		expect(view.text()).toContain("subcomm round ahead");

		view.unmount();
	});

	it("lets a resident skip out at any point", () => {
		const onClose = vi.fn();
		const view = render([VOLLEYBALL], onClose);

		const skip = Array.from(document.querySelectorAll("button")).find(
			(button) => button.textContent === "Skip",
		);
		act(() => skip?.click());

		expect(onClose).toHaveBeenCalledOnce();

		view.unmount();
	});

	it("restores page scrolling when it closes", () => {
		const view = render([VOLLEYBALL]);
		expect(document.body.style.overflow).toBe("hidden");

		view.unmount();
		expect(document.body.style.overflow).not.toBe("hidden");
	});
});

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

/**
 * jsdom has no layout, so the envelope measures 0x0 unless we say otherwise.
 * These are the real numbers off a 390px-wide phone: `min(520px, 86vw)` gives a
 * 336px envelope inset 27px from each edge.
 */
const ENVELOPE_LEFT = 27;
const ENVELOPE_WIDTH = 336;

function stubEnvelopeBox() {
	return vi
		.spyOn(Element.prototype, "getBoundingClientRect")
		.mockReturnValue({ left: ENVELOPE_LEFT, width: ENVELOPE_WIDTH } as DOMRect);
}

/**
 * Drag across the envelope from one viewport x to another. jsdom ships no
 * `PointerEvent`, and React only needs the native event name plus `clientX`.
 */
function drag(fromX: number, toX: number) {
	const envelope = document.querySelector<HTMLElement>(
		'[aria-label="Open your allocation envelope"]',
	);
	expect(envelope).not.toBeNull();

	const fire = (type: string, clientX: number) =>
		envelope!.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX }));

	act(() => {
		fire("pointerdown", fromX);
	});
	act(() => {
		fire("pointermove", toX);
	});
	act(() => {
		fire("pointerup", toX);
	});
}

/**
 * A quick flick: the release lands in the same React batch as the last move, so
 * any state the end-of-drag path reads through its render closure is a frame
 * stale. Separate `act()` calls per event would flush that away and hide it.
 */
function flick(fromX: number, toX: number, onChild = false) {
	const envelope = document.querySelector<HTMLElement>(
		'[aria-label="Open your allocation envelope"]',
	);
	expect(envelope).not.toBeNull();
	// Tapping the dashed cut line hits a descendant, not the envelope itself.
	const target = onChild ? (envelope!.querySelector("span") ?? envelope!) : envelope!;
	const fire = (type: string, clientX: number, node: Element = target) =>
		node.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX }));

	act(() => {
		fire("pointerdown", fromX);
	});
	act(() => {
		// Pointer capture moves the pointer off the tapped child; React synthesises
		// a leave on the envelope from this, which must not end the drag.
		fire("pointerout", fromX);
		fire("pointerleave", fromX);
		for (let i = 1; i <= 6; i++) fire("pointermove", fromX + ((toX - fromX) * i) / 6, envelope!);
		fire("pointerup", toX, envelope!);
	});
}

describe("AllocationRevealOverlay", () => {
	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		document.body.innerHTML = "";
		document.body.style.overflow = "";
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

	// The cut is a position on the envelope, not a distance travelled. Measuring
	// travel meant the finish line sat ~189px right of the finger, so any grab
	// past the envelope's midpoint on a phone put it off the edge of the screen
	// and the envelope could not be opened at all.
	it("opens on a swipe that starts in the right half of the envelope", () => {
		stubEnvelopeBox();
		const view = render([VOLLEYBALL]);

		// Grab at 60% across, release at the envelope's right edge — 134px of
		// travel, well inside what a 390px screen allows from that start point.
		drag(ENVELOPE_LEFT + ENVELOPE_WIDTH * 0.6, ENVELOPE_LEFT + ENVELOPE_WIDTH);

		act(() => vi.advanceTimersByTime(3000));
		expect(view.text()).toContain("Sheares Volleyball");

		view.unmount();
	});

	it("treats a grab past the finish line with no travel as a tap, not a cut", () => {
		stubEnvelopeBox();
		const view = render([VOLLEYBALL]);

		// Already past CUT_DONE on contact, but only 10px of movement.
		drag(ENVELOPE_LEFT + ENVELOPE_WIDTH * 0.9, ENVELOPE_LEFT + ENVELOPE_WIDTH * 0.9 + 10);

		act(() => vi.advanceTimersByTime(3000));
		expect(view.text()).toContain("Your allocations are ready.");
		expect(view.text()).not.toContain("Training IC");

		view.unmount();
	});

	// Re-applying an identical animation declaration does not restart it, so the
	// nudge has to alternate between two names to fire on every failed swipe.
	it("nudges again on a second failed swipe", () => {
		stubEnvelopeBox();
		const view = render([VOLLEYBALL]);
		const envelope = document.querySelector<HTMLElement>(
			'[aria-label="Open your allocation envelope"]',
		)!;

		drag(ENVELOPE_LEFT, ENVELOPE_LEFT + 60);
		const first = envelope.style.animation;
		drag(ENVELOPE_LEFT, ENVELOPE_LEFT + 60);
		const second = envelope.style.animation;

		expect(first).toContain("reveal-nudge");
		expect(second).toContain("reveal-nudge");
		expect(second).not.toBe(first);
		expect(view.text()).toContain("Your allocations are ready.");

		view.unmount();
	});

	// A flick ends with the last move and the release in one batch. Reading `cut`
	// from the render closure there saw a stale value and rejected the swipe.
	it("opens on a flick whose release batches with the last move", () => {
		stubEnvelopeBox();
		const view = render([VOLLEYBALL]);

		flick(ENVELOPE_LEFT + ENVELOPE_WIDTH * 0.3, ENVELOPE_LEFT + ENVELOPE_WIDTH * 0.85);

		act(() => vi.advanceTimersByTime(3000));
		expect(view.text()).toContain("Sheares Volleyball");

		view.unmount();
	});

	// Pressing the dashed cut line lands on a descendant. Capture then moves the
	// pointer to the envelope, which React reports as a leave on the envelope —
	// wiring that to the end-of-drag path killed the gesture on contact.
	it("survives the leave that pointer capture fires when the press starts on a child", () => {
		stubEnvelopeBox();
		const view = render([VOLLEYBALL]);

		flick(ENVELOPE_LEFT + ENVELOPE_WIDTH * 0.3, ENVELOPE_LEFT + ENVELOPE_WIDTH * 0.85, true);

		act(() => vi.advanceTimersByTime(3000));
		expect(view.text()).toContain("Sheares Volleyball");

		view.unmount();
	});

	it("restores page scrolling when it closes", () => {
		const view = render([VOLLEYBALL]);
		expect(document.body.style.overflow).toBe("hidden");

		view.unmount();
		expect(document.body.style.overflow).not.toBe("hidden");
	});
});

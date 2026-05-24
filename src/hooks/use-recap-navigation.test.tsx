import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecapNavigation } from "@/hooks/use-recap-navigation";
import type { RecapSlide } from "@/types/recap";

const makeSlides = (n: number): RecapSlide[] =>
	Array.from({ length: n }, (_, i) => ({
		id: `slide-${i}`,
		eyebrow: "Eyebrow",
		title: `Slide ${i}`,
		description: "desc",
		accent: "from-blue-500",
		kind: "copy" as const,
		statValue: "10",
	}));

describe("useRecapNavigation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	});

	const renderHook = (slides: RecapSlide[], open: boolean) => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const root: Root = createRoot(container);
		const result: { current: ReturnType<typeof useRecapNavigation> | null } = { current: null };

		function Harness() {
			result.current = useRecapNavigation(slides, open);
			return null;
		}

		act(() => {
			root.render(<Harness />);
		});

		return {
			result,
			unmount: () => {
				act(() => {
					root.unmount();
				});
				container.remove();
			},
		};
	};

	it("paginate(1) does not move past the last slide", () => {
		const slides = makeSlides(3);
		const { result, unmount } = renderHook(slides, true);

		act(() => {
			result.current?.paginate(1);
		}); // 0 -> 1
		act(() => {
			result.current?.paginate(1);
		}); // 1 -> 2
		act(() => {
			result.current?.paginate(1);
		}); // 2 -> stays at 2

		expect(result.current?.currentSlide).toBe(2);
		unmount();
	});

	it("paginate(-1) does not move below slide 0", () => {
		const slides = makeSlides(3);
		const { result, unmount } = renderHook(slides, true);

		act(() => {
			result.current?.paginate(-1);
		});

		expect(result.current?.currentSlide).toBe(0);
		unmount();
	});

	it("dot-selection changes currentSlide and direction based on selected index", () => {
		const slides = makeSlides(4);
		const { result, unmount } = renderHook(slides, true);

		act(() => {
			// Simulate selecting dot at index 3 from index 0 (forward)
			result.current?.setDirection(1);
			result.current?.setCurrentSlide(3);
		});
		expect(result.current?.currentSlide).toBe(3);
		expect(result.current?.direction).toBe(1);

		act(() => {
			// Simulate selecting dot at index 1 from index 3 (backward)
			result.current?.setDirection(-1);
			result.current?.setCurrentSlide(1);
		});
		expect(result.current?.currentSlide).toBe(1);
		expect(result.current?.direction).toBe(-1);
		unmount();
	});
});

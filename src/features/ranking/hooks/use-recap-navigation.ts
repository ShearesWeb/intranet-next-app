"use client";

import { useEffect, useRef, useState } from "react";
import { animate, type PanInfo } from "framer-motion";
import type { RecapSlide } from "@/features/ranking/types/recap";

const swipeThreshold = 70;

export function useRecapNavigation(slides: RecapSlide[], open: boolean) {
	const [currentSlide, setCurrentSlide] = useState(0);
	const [direction, setDirection] = useState(1);
	const [displayCount, setDisplayCount] = useState(0);
	const displayCountRef = useRef(0);

	useEffect(() => {
		if (!open) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowRight") {
				setDirection(1);
				setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
			}
			if (event.key === "ArrowLeft") {
				setDirection(-1);
				setCurrentSlide((prev) => Math.max(prev - 1, 0));
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, slides.length]);

	useEffect(() => {
		if (!open) {
			setDisplayCount(0);
			displayCountRef.current = 0;
			return;
		}

		const activeSlide = slides[currentSlide];
		if (!activeSlide) return;

		const target = Number(activeSlide.statValue || 0);
		if (!Number.isFinite(target)) {
			setDisplayCount(0);
			return;
		}

		const from = displayCountRef.current;
		const delta = Math.abs(target - from);

		let controls: ReturnType<typeof animate>;

		if (activeSlide.id === "reveal") {
			const mid = from + (target - from) * 0.6;
			controls = animate(from, [mid, target], {
				times: [0, 0.7, 1],
				duration: 2.2,
				ease: [0.33, 1, 0.68, 1],
				delay: 0.12,
				onUpdate: (latest) => {
					displayCountRef.current = Number(latest);
					setDisplayCount(Math.round(Number(latest)));
				},
			});
		} else if (activeSlide.id === "intro") {
			controls = animate(from, target, {
				duration: 1.4,
				ease: [0.16, 1, 0.3, 1],
				delay: 0.08,
				onUpdate: (latest) => {
					displayCountRef.current = latest;
					setDisplayCount(Math.round(latest));
				},
			});
		} else {
			controls = animate(from, target, {
				duration: Math.min(1.3, Math.max(0.7, delta * 0.06)),
				ease: [0.22, 1, 0.36, 1],
				onUpdate: (latest) => {
					displayCountRef.current = latest;
					setDisplayCount(Math.round(latest));
				},
			});
		}

		return () => controls.stop();
	}, [currentSlide, open, slides]);

	const paginate = (nextDirection: number) => {
		setDirection(nextDirection);
		setCurrentSlide((prev) => {
			const nextSlide = prev + nextDirection;
			if (nextSlide < 0 || nextSlide >= slides.length) {
				return prev;
			}
			return nextSlide;
		});
	};

	const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
		if (info.offset.x <= -swipeThreshold) {
			paginate(1);
		}
		if (info.offset.x >= swipeThreshold) {
			paginate(-1);
		}
	};

	return {
		currentSlide,
		setCurrentSlide,
		direction,
		setDirection,
		displayCount,
		paginate,
		handleDragEnd,
	};
}

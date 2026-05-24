"use client";

import { useEffect, useRef, useState } from "react";
import type { RecapSlide } from "@/types/recap";

/** Attempt a cubic-bezier-style easing for the count-up. */
function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate a numeric value from `from` to `to` using requestAnimationFrame.
 * Returns a stop function.
 */
function animateValue(
	from: number,
	to: number,
	duration: number,
	delay: number,
	onUpdate: (value: number) => void,
): { stop: () => void } {
	let rafId: number | null = null;
	let stopped = false;

	const delayMs = delay * 1000;
	const durationMs = duration * 1000;

	const timeoutId = setTimeout(() => {
		if (stopped) return;
		const startTime = performance.now();

		const tick = (now: number) => {
			if (stopped) return;
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / durationMs, 1);
			const eased = easeOutCubic(progress);
			const current = from + (to - from) * eased;
			onUpdate(current);

			if (progress < 1) {
				rafId = requestAnimationFrame(tick);
			}
		};

		rafId = requestAnimationFrame(tick);
	}, delayMs);

	return {
		stop: () => {
			stopped = true;
			clearTimeout(timeoutId);
			if (rafId !== null) cancelAnimationFrame(rafId);
		},
	};
}

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

		let duration: number;
		let delay: number;

		if (activeSlide.id === "reveal") {
			duration = 2.2;
			delay = 0.12;
		} else if (activeSlide.id === "intro") {
			duration = 1.4;
			delay = 0.08;
		} else {
			duration = Math.min(1.3, Math.max(0.7, delta * 0.06));
			delay = 0;
		}

		const controls = animateValue(from, target, duration, delay, (latest) => {
			displayCountRef.current = latest;
			setDisplayCount(Math.round(latest));
		});

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

	return {
		currentSlide,
		setCurrentSlide,
		direction,
		setDirection,
		displayCount,
		paginate,
	};
}

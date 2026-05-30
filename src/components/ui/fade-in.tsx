"use client";

import { type ReactNode } from "react";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "scale";

const animationClass: Record<Direction, string> = {
	up: "animate-[fade-up_0.7s_cubic-bezier(0.22,1,0.36,1)_both]",
	down: "animate-[fade-down_0.7s_cubic-bezier(0.22,1,0.36,1)_both]",
	left: "animate-[slide-in-left_0.7s_cubic-bezier(0.22,1,0.36,1)_both]",
	right: "animate-[slide-in-right_0.7s_cubic-bezier(0.22,1,0.36,1)_both]",
	scale: "animate-[fade-in-scale_0.6s_cubic-bezier(0.22,1,0.36,1)_both]",
};

interface FadeInProps {
	children: ReactNode;
	className?: string;
	delay?: number;
	direction?: Direction;
}

export function FadeIn({ children, className, delay = 0, direction = "up" }: FadeInProps) {
	const { ref, isInView } = useInView();

	return (
		<div
			ref={ref}
			className={cn(isInView ? animationClass[direction] : "opacity-0", className)}
			style={isInView && delay > 0 ? { animationDelay: `${delay}s` } : undefined}
		>
			{children}
		</div>
	);
}

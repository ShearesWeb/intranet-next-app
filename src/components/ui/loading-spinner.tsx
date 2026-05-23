"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface LoadingSpinnerProps {
	message?: string;
	fullHeight?: boolean;
	className?: string;
	overlay?: boolean;
}

export function LoadingSpinner({
	message = "Loading...",
	fullHeight = true,
	className,
	overlay = false,
}: LoadingSpinnerProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center w-full bg-background/50 backdrop-blur-sm z-50",
				overlay
					? "fixed inset-0 h-screen w-screen z-[9999]"
					: fullHeight
						? "min-h-[60vh] h-full"
						: "py-12",
				className,
			)}
		>
			<div className="relative flex items-center justify-center mb-8">
				{/* Outer rotating ring */}
				<div
					className="absolute inset-0 rounded-full border-t-2 border-r-2 border-primary/30 animate-[spin_2s_linear_infinite]"
					style={{ width: "120px", height: "120px", margin: "-20px" }}
				/>

				{/* Inner rotating ring (reverse) */}
				<div
					className="absolute inset-0 rounded-full border-b-2 border-l-2 border-primary/60 animate-[spin_3s_linear_infinite_reverse]"
					style={{ width: "100px", height: "100px", margin: "-10px" }}
				/>

				{/* Pulsing Logo */}
				<div
					className="relative z-10 bg-background rounded-full p-2 shadow-lg animate-[pulse-logo_2s_ease-in-out_infinite]"
				>
					<Image
						src="/images/shweb-logo.png"
						alt="Loading"
						width={64}
						height={64}
						className="object-contain"
						priority
					/>
				</div>
			</div>

			{/* Loading Message */}
			<div
				className="flex flex-col items-center gap-2 animate-[fade-in-up_0.4s_ease-out_0.2s_both]"
			>
				<h3 className="text-lg font-medium text-foreground tracking-tight">{message}</h3>
				<div className="flex gap-1">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce-dot_1s_ease-in-out_infinite]"
							style={{ animationDelay: `${i * 0.2}s` }}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

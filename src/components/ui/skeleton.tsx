import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn(
				"bg-accent relative overflow-hidden rounded-md",
				// Directional shimmer sweep — reads as "actively loading" rather than a flat pulse.
				"after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-foreground/10 after:to-transparent after:content-[''] after:animate-[skeleton-sweep_1.6s_ease-in-out_infinite]",
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };

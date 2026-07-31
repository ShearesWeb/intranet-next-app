import { cn } from "@/lib/utils";

interface StatusPillProps {
	label: string;
	/** Hex color driving a translucent background and solid text. */
	color?: string;
	capitalize?: boolean;
	className?: string;
}

/** Rounded status pill used across booking, subsidy, and ranking tables. */
export function StatusPill({ label, color, capitalize, className }: StatusPillProps) {
	return (
		<span
			className={cn(
				"inline-block rounded-full px-2 py-0.5 text-xs font-medium",
				capitalize && "capitalize",
				className,
			)}
			style={color ? { backgroundColor: `${color}20`, color } : undefined}
		>
			{label}
		</span>
	);
}

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingProgressBarProps {
	ranked: number;
	total: number;
	className?: string;
}

/** Compact ranked/total completion bar: red at 0, amber in progress, green complete. */
export function RankingProgressBar({ ranked, total, className }: RankingProgressBarProps) {
	if (total === 0) {
		return <span className={cn("text-xs text-muted-foreground", className)}>No members</span>;
	}

	const complete = ranked >= total;
	const percent = Math.floor((ranked / total) * 100);
	const fill = complete
		? "bg-gradient-to-r from-emerald-500 to-emerald-400"
		: ranked === 0
			? "bg-gradient-to-r from-red-500 to-red-400"
			: "bg-gradient-to-r from-amber-500 to-amber-400";
	const text = complete
		? "text-emerald-600 dark:text-emerald-400"
		: ranked === 0
			? "text-red-600 dark:text-red-400"
			: "text-amber-600 dark:text-amber-400";

	return (
		<span
			title={`${ranked} of ${total} member${total === 1 ? "" : "s"} ranked (${percent}%).`}
			className={cn("flex items-center gap-2", className)}
		>
			<span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
				<span
					className={cn("block h-full rounded-full transition-[width] duration-500 ease-out", fill)}
					style={{ width: `${ranked > 0 ? Math.max((ranked / total) * 100, 4) : 0}%` }}
				/>
			</span>
			<span
				className={cn("inline-flex items-center gap-1 text-xs font-semibold tabular-nums", text)}
			>
				{complete && <CheckCircle2 className="size-3.5" />}
				{ranked}/{total} ranked
			</span>
		</span>
	);
}

import { Sparkles } from "lucide-react";
import {
	MAX_PREFERENCES,
	getPreferenceUsage,
	type PreferenceTier,
} from "@/lib/allocation/preference-cap";
import { cn } from "@/lib/utils";

const TIER_FILL_STYLES: Record<PreferenceTier, string> = {
	empty: "bg-muted-foreground/30",
	critical: "bg-gradient-to-r from-red-500 to-red-400",
	low: "bg-gradient-to-r from-amber-500 to-amber-400",
	good: "bg-gradient-to-r from-emerald-500 to-emerald-400",
	full: "bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.55)]",
};

const TIER_TEXT_STYLES: Record<PreferenceTier, string> = {
	empty: "text-muted-foreground",
	critical: "text-red-600 dark:text-red-400",
	low: "text-amber-600 dark:text-amber-400",
	good: "text-emerald-600 dark:text-emerald-400",
	full: "text-purple-600 dark:text-purple-400",
};

// One divider between each pair of slots, so the track reads as MAX_PREFERENCES segments.
const SLOT_DIVIDERS = Array.from({ length: MAX_PREFERENCES - 1 }, (_, i) => ({
	slot: i + 1,
	left: `${((i + 1) / MAX_PREFERENCES) * 100}%`,
}));

function usageTitle(count: number): string {
	return `${Math.min(count, MAX_PREFERENCES)} of ${MAX_PREFERENCES} preference slots used. You may rank at most ${MAX_PREFERENCES} positions.`;
}

interface PreferenceCapMeterProps {
	selectedCount: number;
	className?: string;
}

/**
 * Slot meter toward the {@link MAX_PREFERENCES} cap.
 * Fill color steps through red → amber → green → purple as the list fills up.
 */
export function PreferenceCapMeter({ selectedCount, className }: PreferenceCapMeterProps) {
	const { count, max, remaining, percent, tier, atCap } = getPreferenceUsage(selectedCount);
	const shown = Math.min(count, max);

	return (
		<div title={usageTitle(count)} className={cn("flex flex-col", className)}>
			<div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<span className="text-sm">
					<span className={cn("font-semibold tabular-nums", TIER_TEXT_STYLES[tier])}>
						{shown}/{max}
					</span>{" "}
					<span className="text-xs text-muted-foreground">preference slots used</span>
				</span>
				{atCap ? (
					<span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
						<Sparkles className="size-3.5" />
						All {max} slots used
					</span>
				) : (
					<span className="text-xs text-muted-foreground">
						{remaining} slot{remaining === 1 ? "" : "s"} left
					</span>
				)}
			</div>

			<div className="relative">
				<div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
					<div
						className={cn(
							"h-full rounded-full transition-[width] duration-500 ease-out",
							TIER_FILL_STYLES[tier],
						)}
						style={{ width: `${percent}%` }}
					/>
				</div>
				{SLOT_DIVIDERS.map(({ slot, left }) => (
					<span
						key={slot}
						className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-background/90"
						style={{ left }}
					/>
				))}
			</div>

			<div className="relative mt-1 h-4 text-[10px] font-medium">
				{SLOT_DIVIDERS.map(({ slot, left }) => (
					<span
						key={slot}
						className={cn(
							"absolute -translate-x-1/2 tabular-nums transition-colors",
							shown >= slot ? TIER_TEXT_STYLES[tier] : "text-muted-foreground/70",
						)}
						style={{ left }}
					>
						{slot}
					</span>
				))}
				<span
					className={cn(
						"absolute right-0 tabular-nums transition-colors",
						atCap ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground/70",
					)}
				>
					{max} max
				</span>
			</div>
		</div>
	);
}

/** Compact bar + count for sticky bars and toolbars. */
export function PreferenceCapMeterMini({ selectedCount, className }: PreferenceCapMeterProps) {
	const { count, max, percent, tier } = getPreferenceUsage(selectedCount);

	return (
		<span title={usageTitle(count)} className={cn("flex items-center gap-2", className)}>
			<span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
				<span
					className={cn("block h-full rounded-full", TIER_FILL_STYLES[tier])}
					style={{ width: `${percent}%` }}
				/>
			</span>
			<span className={cn("text-xs font-semibold tabular-nums", TIER_TEXT_STYLES[tier])}>
				{Math.min(count, max)}/{max}
			</span>
		</span>
	);
}

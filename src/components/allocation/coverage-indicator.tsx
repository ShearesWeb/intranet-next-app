import { Sparkles } from "lucide-react";
import {
	COVERAGE_TARGET_MULTIPLIER,
	getCandidateCoverage,
	type CoverageTier,
} from "@/lib/allocation/candidate-coverage";
import { cn } from "@/lib/utils";

const TIER_FILL_STYLES: Record<CoverageTier, string> = {
	critical: "bg-gradient-to-r from-red-500 to-red-400",
	low: "bg-gradient-to-r from-amber-500 to-amber-400",
	good: "bg-gradient-to-r from-emerald-500 to-emerald-400",
	target:
		"bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.55)]",
	full: "bg-muted-foreground/40",
};

const TIER_TEXT_STYLES: Record<CoverageTier, string> = {
	critical: "text-red-600 dark:text-red-400",
	low: "text-amber-600 dark:text-amber-400",
	good: "text-emerald-600 dark:text-emerald-400",
	target: "text-purple-600 dark:text-purple-400",
	full: "text-muted-foreground",
};

// Track spans 0–200%, so a coverage milestone sits at half its value along the track.
const MILESTONES: Array<{ pct: number; left: string }> = [
	{ pct: 100, left: "50%" },
	{ pct: 150, left: "75%" },
];

function coverageTitle(candidateCount: number, capacity: number): string {
	const { percent, target } = getCandidateCoverage(candidateCount, capacity);
	if (percent === null) return "No capacity target is configured for this position.";
	return `${candidateCount} ranked of ${target} recommended (${COVERAGE_TARGET_MULTIPLIER * 100}% of ${capacity} total seat${capacity === 1 ? "" : "s"}).`;
}

interface CoverageMeterProps {
	candidateCount: number;
	capacity: number;
	className?: string;
}

/**
 * Milestone progress meter toward the 200%-of-total-capacity ranking goal.
 * Fill color steps through red → amber → green → purple as coverage grows.
 */
export function CoverageMeter({ candidateCount, capacity, className }: CoverageMeterProps) {
	const { tier, percent, target } = getCandidateCoverage(candidateCount, capacity);

	if (percent === null) {
		return (
			<p className={cn("text-xs text-muted-foreground", className)}>
				No capacity target is configured for this position.
			</p>
		);
	}

	const goalPercent = COVERAGE_TARGET_MULTIPLIER * 100;
	const fillWidth = Math.min(100, (percent / goalPercent) * 100);
	const remaining = Math.max(0, target - candidateCount);
	const goalReached = tier === "target";

	return (
		<div title={coverageTitle(candidateCount, capacity)} className={cn("flex flex-col", className)}>
			<div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<span className="text-sm">
					<span className={cn("font-semibold tabular-nums", TIER_TEXT_STYLES[tier])}>
						{percent}%
					</span>{" "}
					<span className="text-xs text-muted-foreground">
						of total capacity ranked · {candidateCount}/{target} candidates
					</span>
				</span>
				{goalReached ? (
					<span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
						<Sparkles className="size-3.5" />
						{goalPercent}% goal reached
					</span>
				) : (
					<span className="text-xs text-muted-foreground">
						{remaining} more to the {goalPercent}% goal
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
						style={{ width: `${candidateCount > 0 ? Math.max(fillWidth, 3) : 0}%` }}
					/>
				</div>
				{MILESTONES.map(({ pct, left }) => (
					<span
						key={pct}
						className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-background/90"
						style={{ left }}
					/>
				))}
			</div>

			<div className="relative mt-1 h-4 text-[10px] font-medium">
				{MILESTONES.map(({ pct, left }) => (
					<span
						key={pct}
						className={cn(
							"absolute -translate-x-1/2 tabular-nums transition-colors",
							percent >= pct
								? pct >= 150
									? "text-emerald-600 dark:text-emerald-400"
									: "text-amber-600 dark:text-amber-400"
								: "text-muted-foreground/70",
						)}
						style={{ left }}
					>
						{pct}%
					</span>
				))}
				<span
					className={cn(
						"absolute right-0 tabular-nums transition-colors",
						goalReached ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground/70",
					)}
				>
					{goalPercent}% goal
				</span>
			</div>
		</div>
	);
}

/** Compact bar + percent for table cells. */
export function CoverageMeterMini({ candidateCount, capacity, className }: CoverageMeterProps) {
	const { tier, percent } = getCandidateCoverage(candidateCount, capacity);
	const goalPercent = COVERAGE_TARGET_MULTIPLIER * 100;

	if (percent === null) {
		return (
			<span
				title={coverageTitle(candidateCount, capacity)}
				className={cn("text-xs text-muted-foreground", className)}
			>
				No target
			</span>
		);
	}

	const fillWidth = Math.min(100, (percent / goalPercent) * 100);
	return (
		<span
			title={coverageTitle(candidateCount, capacity)}
			className={cn("flex items-center gap-2", className)}
		>
			<span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
				<span
					className={cn("block h-full rounded-full", TIER_FILL_STYLES[tier])}
					style={{ width: `${candidateCount > 0 ? Math.max(fillWidth, 4) : 0}%` }}
				/>
			</span>
			<span className={cn("text-xs font-semibold tabular-nums", TIER_TEXT_STYLES[tier])}>
				{percent}%
			</span>
		</span>
	);
}

const LEGEND_ITEMS: Array<{ tier: CoverageTier; label: string }> = [
	{ tier: "critical", label: "below 100%" },
	{ tier: "low", label: "100%+" },
	{ tier: "good", label: "150%+" },
	{ tier: "target", label: "200%+ (goal)" },
];

/** Compact color legend for the coverage tiers. */
export function CoverageLegend({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
				className,
			)}
		>
			<span>
				Aim to rank {COVERAGE_TARGET_MULTIPLIER * 100}% of each position&apos;s total capacity:
			</span>
			{LEGEND_ITEMS.map(({ tier, label }) => (
				<span key={tier} className="inline-flex items-center gap-1.5">
					<span className={cn("size-2 rounded-full", TIER_FILL_STYLES[tier])} />
					{label}
				</span>
			))}
		</div>
	);
}

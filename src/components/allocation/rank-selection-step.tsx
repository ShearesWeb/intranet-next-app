"use client";

import React from "react";
import { ArrowRight, Check, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { DashedEmpty } from "@/components/shared/inline-states";
import {
	PreferenceCapMeter,
	PreferenceCapMeterMini,
} from "@/components/allocation/preference-cap-meter";
import { MAX_PREFERENCES, getPreferenceUsage } from "@/lib/allocation/preference-cap";
import { cn } from "@/lib/utils";
import type { RankablePosition } from "@/types/preferences";

interface RankSelectionStepProps {
	allPositions: RankablePosition[];
	selectedIds: Set<number>;
	onToggle: (positionId: number) => void;
	onProceed: () => void;
}

// Maincomm and subcomm lead the page; any other commitment type follows alphabetically.
const GROUP_ORDER: Record<string, number> = { maincomm: 0, subcomm: 1 };

const GROUP_LABELS: Record<string, string> = {
	maincomm: "Maincomm",
	subcomm: "Subcomm",
	blockcomm: "Blockcomm",
	"team manager": "Team Manager",
};

const humanize = (value: string) =>
	value
		.replace(/[_-]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

interface PositionGroup {
	key: string;
	label: string;
	positions: RankablePosition[];
}

function groupByType(positions: RankablePosition[]): PositionGroup[] {
	const buckets = new Map<string, RankablePosition[]>();
	for (const pos of positions) {
		const key = (pos.position_type || "other").toLowerCase().trim();
		const bucket = buckets.get(key);
		if (bucket) bucket.push(pos);
		else buckets.set(key, [pos]);
	}
	return [...buckets.entries()]
		.map(([key, group]) => ({
			key,
			label: GROUP_LABELS[key] ?? humanize(key),
			positions: [...group].sort(
				(a, b) => a.cca_name.localeCompare(b.cca_name) || a.name.localeCompare(b.name),
			),
		}))
		.sort((a, b) => {
			const orderA = GROUP_ORDER[a.key] ?? 2;
			const orderB = GROUP_ORDER[b.key] ?? 2;
			return orderA - orderB || a.label.localeCompare(b.label);
		});
}

export function RankSelectionStep({
	allPositions,
	selectedIds,
	onToggle,
	onProceed,
}: RankSelectionStepProps) {
	const [query, setQuery] = React.useState("");
	const count = selectedIds.size;
	const { atCap } = getPreferenceUsage(count);

	const groups = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		const visible = q
			? allPositions.filter(
					(p) => p.name.toLowerCase().includes(q) || p.cca_name.toLowerCase().includes(q),
				)
			: allPositions;
		return groupByType(visible);
	}, [allPositions, query]);

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Indicate your CCA preferences"
				description="Tick every position you'd genuinely consider joining. You'll order them by preference in the next step. Positions that are already full are hidden automatically."
			/>

			<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
				<Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
				<div className="text-amber-900 dark:text-amber-200">
					<span className="font-semibold">Pick generously.</span> The more positions you select, the
					better the algorithm can match you. Picking only one or two is the most common reason
					students end up unmatched.
				</div>
			</div>

			<div className="max-w-xl rounded-xl border p-4">
				<PreferenceCapMeter selectedCount={count} />
				{atCap && (
					<p className="mt-2 text-xs text-muted-foreground">
						You&apos;ve used all {MAX_PREFERENCES} slots. Untick a position to swap in a different
						one.
					</p>
				)}
			</div>

			<div className="relative max-w-sm">
				<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search by position or CCA..."
					className="pl-8"
				/>
			</div>

			{groups.length === 0 ? (
				<DashedEmpty className="p-8">
					{query ? "No positions match your search." : "No positions are open for preferences."}
				</DashedEmpty>
			) : (
				groups.map((group) => {
					const groupSelected = group.positions.filter((p) => selectedIds.has(p.id)).length;
					return (
						<section key={group.key} className="flex flex-col gap-3">
							<div className="flex items-baseline justify-between gap-2">
								<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
									{group.label}
								</h2>
								<span className="text-xs tabular-nums text-muted-foreground">
									{groupSelected > 0
										? `${groupSelected} of ${group.positions.length} selected`
										: `${group.positions.length} position${group.positions.length === 1 ? "" : "s"}`}
								</span>
							</div>
							<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
								{group.positions.map((pos) => {
									const selected = selectedIds.has(pos.id);
									const blocked = atCap && !selected;
									return (
										<button
											key={pos.id}
											type="button"
											role="checkbox"
											aria-checked={selected}
											aria-disabled={blocked}
											disabled={blocked}
											title={
												blocked
													? `You can rank at most ${MAX_PREFERENCES} preferences. Untick one to make room.`
													: undefined
											}
											onClick={() => onToggle(pos.id)}
											className={cn(
												"group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
												selected
													? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
													: "hover:border-primary/40 hover:bg-muted/40",
												blocked &&
													"cursor-not-allowed opacity-50 hover:border-border hover:bg-transparent",
											)}
										>
											<span
												className={cn(
													"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
													selected
														? "border-primary bg-primary text-primary-foreground"
														: "border-muted-foreground/40 group-hover:border-primary/60",
												)}
											>
												{selected && <Check className="size-3.5" />}
											</span>
											<span className="flex min-w-0 flex-col gap-0.5">
												<span className="truncate font-medium leading-tight">{pos.name}</span>
												<span className="truncate text-sm text-muted-foreground">
													{pos.cca_name}
												</span>
												<span className="text-xs tabular-nums text-muted-foreground">
													{pos.available_capacity}/{pos.capacity} slots left
												</span>
											</span>
										</button>
									);
								})}
							</div>
						</section>
					);
				})
			)}

			<div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
					<PreferenceCapMeterMini selectedCount={count} />
					<span className="text-sm text-muted-foreground">
						{count === 0
							? "No preferences selected"
							: `${count} preference${count === 1 ? "" : "s"} selected`}
					</span>
				</div>
				<Button onClick={onProceed} disabled={count === 0} className="gap-2">
					Next: Order your preferences
					<ArrowRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

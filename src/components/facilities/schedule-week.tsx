"use client";

import { useMemo } from "react";
import { buildWeek, type Cluster, type ScheduleSlot } from "@/lib/facilities/schedule-grid";
import { cn } from "@/lib/utils";

// Display order: Monday-first, matching the JCRC mental model.
const DISPLAY_DAYS: { day: number; label: string }[] = [
	{ day: 1, label: "Mon" },
	{ day: 2, label: "Tue" },
	{ day: 3, label: "Wed" },
	{ day: 4, label: "Thu" },
	{ day: 5, label: "Fri" },
	{ day: 6, label: "Sat" },
	{ day: 0, label: "Sun" },
];

function h12(hour: number): { n: number; ampm: "am" | "pm" } {
	const ampm = hour >= 12 && hour < 24 ? "pm" : "am";
	const n = hour % 12 || 12;
	return { n, ampm };
}

/** "19→21" → "7–9pm"; collapses the meridiem when both ends share it. */
function rangeLabel(startHour: number, endHour: number): string {
	const s = h12(startHour);
	const e = h12(endHour);
	return s.ampm === e.ampm ? `${s.n}–${e.n}${e.ampm}` : `${s.n}${s.ampm}–${e.n}${e.ampm}`;
}

interface ScheduleWeekProps {
	schedules: ScheduleSlot[];
	onSelectCluster?: (day: number, cluster: Cluster) => void;
}

export function ScheduleWeek({ schedules, onSelectCluster }: ScheduleWeekProps) {
	const week = useMemo(() => buildWeek(schedules), [schedules]);
	const colorByPriority = useMemo(() => {
		const m = new Map<number, { color: string; wave: number }>();
		for (const w of week.waves) m.set(w.priority, { color: w.color, wave: w.wave });
		return m;
	}, [week.waves]);

	const dayMap = useMemo(() => {
		const m = new Map<number, Cluster[]>();
		for (const d of week.days) m.set(d.day, d.clusters);
		return m;
	}, [week.days]);

	return (
		<div className="space-y-3">
			{week.waves.length > 0 && (
				<div className="flex flex-wrap items-center gap-3 text-xs">
					<span className="font-medium">Wave</span>
					{week.waves.map((w) => (
						<span key={w.priority} className="inline-flex items-center gap-1.5">
							<span
								className="inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-black"
								style={{ backgroundColor: w.color }}
							>
								{w.wave}
							</span>
						</span>
					))}
					<span className="text-muted-foreground">lower fires first</span>
				</div>
			)}

			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
				{DISPLAY_DAYS.map(({ day, label }) => {
					const clusters = dayMap.get(day) ?? [];
					return (
						<div
							key={day}
							data-testid="day-col"
							data-day={day}
							className="overflow-hidden rounded-lg border bg-card"
						>
							<div className="border-b bg-muted/50 py-1 text-center text-xs font-semibold">
								{label}
							</div>
							{clusters.length === 0 ? (
								<div className="py-4 text-center text-xs text-muted-foreground/40">—</div>
							) : (
								<div className="divide-y">
									{clusters.map((cluster) => (
										<button
											key={`${cluster.startHour}-${cluster.endHour}`}
											type="button"
											data-testid="cluster"
											onClick={() => onSelectCluster?.(day, cluster)}
											className={cn(
												"w-full px-2 py-1.5 text-left transition-colors hover:bg-accent/50",
												onSelectCluster ? "cursor-pointer" : "cursor-default",
											)}
										>
											<div className="mb-1 flex items-center justify-between gap-1 text-[10px] tabular-nums text-muted-foreground">
												<span>{rangeLabel(cluster.startHour, cluster.endHour)}</span>
												<span className="opacity-50">{cluster.total}</span>
											</div>
											<div className="flex flex-wrap items-center gap-1">
												{cluster.waves.map((bucket) => {
													const info = colorByPriority.get(bucket.priority);
													return (
														<span
															key={bucket.priority}
															data-testid="wave-chip"
															className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded px-1 text-[9px] font-bold text-black"
															style={{ backgroundColor: info?.color ?? "#94a3b8" }}
															title={`Wave ${info?.wave ?? "?"} · ${bucket.count} slot(s)`}
														>
															{bucket.count}
														</span>
													);
												})}
											</div>
										</button>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

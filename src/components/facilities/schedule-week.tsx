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

	const dayMap = useMemo(() => {
		const m = new Map<number, Cluster[]>();
		for (const d of week.days) m.set(d.day, d.clusters);
		return m;
	}, [week.days]);

	return (
		<div className="space-y-3">
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
											</div>
											<span
												data-testid="count-chip"
												className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded bg-primary/15 px-1 text-[9px] font-bold text-primary"
												title={`${cluster.total} slot(s)`}
											>
												{cluster.total}
											</span>
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

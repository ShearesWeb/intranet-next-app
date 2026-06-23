"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Cluster,
	ScheduleSlot,
	ScheduleWindow,
	WaveInfo,
	mergeContiguous,
} from "@/lib/facilities/schedule-grid";
import { WEEKDAY_LABELS, formatHour } from "@/types/facilities";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

interface ScheduleClusterPanelProps {
	day: number;
	cluster: Cluster;
	schedules: ScheduleSlot[];
	waves: WaveInfo[];
	onChanged: () => void;
	onAddSlot: () => void;
	onEditWindow: (day: number, window: ScheduleWindow) => void;
}

export function ScheduleClusterPanel({
	day,
	cluster,
	schedules,
	waves,
	onChanged,
	onAddSlot,
	onEditWindow,
}: ScheduleClusterPanelProps) {
	const [busyKey, setBusyKey] = useState<string | null>(null);

	const colorByPriority = useMemo(() => {
		const m = new Map<number, WaveInfo>();
		for (const w of waves) m.set(w.priority, w);
		return m;
	}, [waves]);

	// Rows in this cluster's day + hour span, merged into contiguous windows
	// (so 7,8,9,10 read as one "7–11pm" window, not four rows).
	const windows = useMemo(() => {
		const rows = schedules.filter(
			(s) => s.day_of_week === day && s.hour >= cluster.startHour && s.hour < cluster.endHour,
		);
		return mergeContiguous(rows).sort(
			(a, b) => a.priority - b.priority || a.sub_venue.localeCompare(b.sub_venue),
		);
	}, [schedules, day, cluster]);

	async function removeWindow(w: ScheduleWindow) {
		const key = w.ids.join(",");
		setBusyKey(key);
		try {
			const results = await Promise.all(
				w.ids.map((id) =>
					fetch(`/api/facilities/schedules?id=${id}`, { method: "DELETE" }).then((r) => r.ok),
				),
			);
			if (results.some((ok) => !ok)) {
				toast.error("Some slots could not be removed");
			} else {
				toast.success("Slots removed");
			}
			onChanged();
		} catch {
			toast.error("Network error");
		} finally {
			setBusyKey(null);
		}
	}

	return (
		<div className="rounded-lg border p-4">
			<div className="mb-3 flex items-center justify-between gap-2">
				<div>
					<h3 className="text-sm font-semibold">
						{WEEKDAY_LABELS[day]} · {formatHour(cluster.startHour)} – {formatHour(cluster.endHour)}
					</h3>
					<p className="text-xs text-muted-foreground">{cluster.total} slot(s) fire together</p>
				</div>
				<Button size="sm" variant="outline" className="gap-1.5" onClick={onAddSlot}>
					<Plus className="h-3.5 w-3.5" />
					Add slot
				</Button>
			</div>

			<div className="space-y-1.5">
				{windows.map((w) => {
					const info = colorByPriority.get(w.priority);
					const key = w.ids.join(",");
					return (
						<div
							key={key}
							className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs"
						>
							<span
								className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold text-black"
								style={{ backgroundColor: info?.color ?? "#94a3b8" }}
								title={`Wave ${info?.wave ?? "?"}`}
							>
								{info?.wave ?? "?"}
							</span>
							<div className="min-w-0 flex-1">
								<div className="truncate font-medium">{w.sub_venue}</div>
								<div className="truncate text-[10px] text-muted-foreground">
									{formatHour(w.startHour)} – {formatHour(w.endHour)}
									{w.reboks_activity ? ` · ${w.reboks_activity}` : ""}
								</div>
							</div>
							<button
								type="button"
								onClick={() => onEditWindow(day, w)}
								className="text-muted-foreground hover:text-primary"
								aria-label="Edit slot"
							>
								<Pencil className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								disabled={busyKey === key}
								onClick={() => removeWindow(w)}
								className="text-muted-foreground hover:text-destructive disabled:opacity-50"
								aria-label="Remove slot"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
}

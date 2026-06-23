"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cluster, ScheduleSlot, WaveInfo } from "@/lib/facilities/schedule-grid";
import { WEEKDAY_LABELS, formatHour } from "@/types/facilities";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface ScheduleClusterPanelProps {
	day: number;
	cluster: Cluster;
	schedules: ScheduleSlot[];
	waves: WaveInfo[];
	onChanged: () => void;
	onAddSlot: () => void;
}

export function ScheduleClusterPanel({
	day,
	cluster,
	schedules,
	waves,
	onChanged,
	onAddSlot,
}: ScheduleClusterPanelProps) {
	const [busyId, setBusyId] = useState<number | null>(null);

	const colorByPriority = useMemo(() => {
		const m = new Map<number, WaveInfo>();
		for (const w of waves) m.set(w.priority, w);
		return m;
	}, [waves]);

	// Raw rows in this cluster's day + hour span — these carry ids for deletion.
	const rows = useMemo(
		() =>
			schedules
				.filter(
					(s) =>
						s.day_of_week === day && s.hour >= cluster.startHour && s.hour < cluster.endHour,
				)
				.sort((a, b) => a.priority - b.priority || a.sub_venue.localeCompare(b.sub_venue) || a.hour - b.hour),
		[schedules, day, cluster],
	);

	async function remove(id: number) {
		setBusyId(id);
		try {
			const res = await fetch(`/api/facilities/schedules?id=${id}`, { method: "DELETE" });
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to remove slot");
				return;
			}
			toast.success("Slot removed");
			onChanged();
		} catch {
			toast.error("Network error");
		} finally {
			setBusyId(null);
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
				{rows.map((s) => {
					const info = colorByPriority.get(s.priority);
					return (
						<div
							key={s.id}
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
								<div className="truncate font-medium">{s.sub_venue}</div>
								<div className="truncate text-[10px] text-muted-foreground">
									{formatHour(s.hour)}
									{s.reboks_activity ? ` · ${s.reboks_activity}` : ""}
								</div>
							</div>
							<button
								type="button"
								disabled={busyId === s.id}
								onClick={() => remove(s.id)}
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

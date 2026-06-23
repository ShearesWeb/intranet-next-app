"use client";

import { useEffect, useMemo, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Facility, FacilityType, WEEKDAY_LABELS, formatHour } from "@/types/facilities";
import { FacilitySelect } from "@/components/facilities/facility-select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-first
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am … 11pm

/** When set, the dialog edits an existing window: it deletes these rows then recreates. */
export interface SlotEditTarget {
	ids: number[];
	facilityId: number;
	day: number;
	hours: number[];
	priority: number;
	reboks_activity: string | null;
}

interface ScheduleSlotDialogProps {
	open: boolean;
	facilities: Facility[];
	/** Pre-select the first facility of this type when opening (the active editor tab). */
	defaultType?: FacilityType;
	defaultDay?: number;
	defaultHour?: number;
	editing?: SlotEditTarget | null;
	onClose: () => void;
	onSuccess: () => void;
}

export function ScheduleSlotDialog({
	open,
	facilities,
	defaultType,
	defaultDay,
	defaultHour,
	editing,
	onClose,
	onSuccess,
}: ScheduleSlotDialogProps) {
	const [facilityId, setFacilityId] = useState<number | null>(null);
	const [days, setDays] = useState<number[]>([]);
	const [hours, setHours] = useState<number[]>([]);
	const [priority, setPriority] = useState<number>(1);
	const [activity, setActivity] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);

	// Prefill from the edit target, else reset to sensible defaults, each time it opens.
	useEffect(() => {
		if (!open) return;
		if (editing) {
			setActivity(editing.reboks_activity ?? "");
			setPriority(editing.priority || 1);
			setDays([editing.day]);
			setHours([...editing.hours]);
			setFacilityId(editing.facilityId);
			return;
		}
		setActivity("");
		setPriority(1);
		setDays(defaultDay != null ? [defaultDay] : []);
		setHours(defaultHour != null ? [defaultHour] : []);
		const def =
			(defaultType && facilities.find((f) => f.active && f.type === defaultType)) ??
			facilities.find((f) => f.active);
		setFacilityId(def?.id ?? null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const selectedFacility = useMemo(
		() => facilities.find((f) => f.id === facilityId) ?? null,
		[facilities, facilityId],
	);
	const isReboks = selectedFacility?.type === "reboks";

	function toggleIn(list: number[], value: number): number[] {
		return list.includes(value) ? list.filter((x) => x !== value) : [...list, value].sort((a, b) => a - b);
	}

	async function submit() {
		if (facilityId == null) {
			toast.error("Pick a facility");
			return;
		}
		if (days.length === 0) {
			toast.error("Pick at least one day");
			return;
		}
		if (hours.length === 0) {
			toast.error("Pick at least one hour");
			return;
		}
		if (isReboks && !activity.trim()) {
			toast.error("REBOKS slots need an activity name");
			return;
		}

		const combos = days.flatMap((day) => hours.map((hour) => ({ day, hour })));
		setSubmitting(true);
		try {
			// Editing = replace: drop the old window's rows, then recreate from the form.
			if (editing) {
				await Promise.all(
					editing.ids.map((id) =>
						fetch(`/api/facilities/schedules?id=${id}`, { method: "DELETE" }).catch(() => undefined),
					),
				);
			}
			const results = await Promise.all(
				combos.map(({ day, hour }) =>
					fetch("/api/facilities/schedules", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							facility_id: facilityId,
							day_of_week: day,
							hour,
							priority: isReboks ? priority : 100,
							reboks_activity: isReboks ? activity.trim() : null,
						}),
					}).then((r) => r.ok || r.status === 409),
				),
			);
			const failed = results.filter((ok) => !ok).length;
			if (failed > 0) toast.warning(`${failed} of ${combos.length} slot(s) could not be added`);
			else toast.success(`${combos.length} slot(s) added`);
			onSuccess();
			onClose();
		} catch {
			toast.error("Network error");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{editing ? "Edit schedule slot" : "Add schedule slot"}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					{/* Facility — standard dropdown with search, grouped by type */}
					<div className="space-y-1.5">
						<Label>Facility</Label>
						<FacilitySelect facilities={facilities} value={facilityId} onChange={setFacilityId} />
					</div>

					{/* Days — multi-select */}
					<div className="space-y-1.5">
						<Label>Days</Label>
						<div className="flex flex-wrap gap-1.5">
							{DISPLAY_DAYS.map((d) => (
								<button
									key={d}
									type="button"
									onClick={() => setDays((prev) => toggleIn(prev, d))}
									className={cn(
										"rounded-md border px-2.5 py-1 text-xs",
										days.includes(d) ? "border-primary bg-primary/10" : "hover:bg-accent",
									)}
								>
									{WEEKDAY_LABELS[d]}
								</button>
							))}
						</div>
					</div>

					{/* Hours — multi-select */}
					<div className="space-y-1.5">
						<Label>Hours</Label>
						<div className="flex flex-wrap gap-1">
							{HOURS.map((h) => (
								<button
									key={h}
									type="button"
									onClick={() => setHours((prev) => toggleIn(prev, h))}
									className={cn(
										"rounded border px-1.5 py-0.5 text-[10px] tabular-nums",
										hours.includes(h) ? "border-primary bg-primary/10" : "hover:bg-accent",
									)}
								>
									{formatHour(h).replace(":00 ", "")}
								</button>
							))}
						</div>
					</div>

					{isReboks && (
						<div className="grid grid-cols-2 gap-3" data-testid="reboks-fields">
							<div className="space-y-1.5">
								<Label htmlFor="priority">Wave (priority)</Label>
								<Input
									id="priority"
									type="number"
									min={1}
									value={priority}
									onChange={(e) => setPriority(Number(e.target.value))}
								/>
								<p className="text-[10px] text-muted-foreground">lower fires first</p>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="activity">Activity</Label>
								<Input
									id="activity"
									value={activity}
									onChange={(e) => setActivity(e.target.value)}
									placeholder="e.g. Tennis Court 1 to 13 (Halls/RCs)"
								/>
							</div>
						</div>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={submit} isLoading={submitting}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

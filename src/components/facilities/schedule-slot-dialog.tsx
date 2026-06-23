"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-first
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am … 11pm

interface ScheduleSlotDialogProps {
	open: boolean;
	type: FacilityType;
	facilities: Facility[];
	defaultDay?: number;
	defaultHour?: number;
	onClose: () => void;
	onSuccess: () => void;
}

export function ScheduleSlotDialog({
	open,
	type,
	facilities,
	defaultDay,
	defaultHour,
	onClose,
	onSuccess,
}: ScheduleSlotDialogProps) {
	const isReboks = type === "reboks";
	const [facilityId, setFacilityId] = useState<number | null>(facilities[0]?.id ?? null);
	const [day, setDay] = useState<number>(defaultDay ?? 1);
	const [hours, setHours] = useState<number[]>(defaultHour != null ? [defaultHour] : []);
	const [priority, setPriority] = useState<number>(1);
	const [activity, setActivity] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);

	function toggleHour(h: number) {
		setHours((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h].sort((a, b) => a - b)));
	}

	async function submit() {
		if (facilityId == null) {
			toast.error("Pick a facility");
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
		setSubmitting(true);
		try {
			const results = await Promise.all(
				hours.map((hour) =>
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
			if (failed > 0) toast.warning(`${failed} slot(s) could not be added`);
			else toast.success("Schedule updated");
			setHours([]);
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
					<DialogTitle>Add schedule slot</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label>Facility</Label>
						<div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
							{facilities.length === 0 && (
								<p className="text-xs text-muted-foreground">No facilities for this type yet.</p>
							)}
							{facilities.map((f) => (
								<button
									key={f.id}
									type="button"
									onClick={() => setFacilityId(f.id)}
									className={cn(
										"rounded-md border px-2 py-1 text-xs",
										facilityId === f.id ? "border-primary bg-primary/10" : "hover:bg-accent",
									)}
								>
									{f.sub_venue}
								</button>
							))}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label>Day</Label>
						<div className="flex flex-wrap gap-1.5">
							{DISPLAY_DAYS.map((d) => (
								<button
									key={d}
									type="button"
									onClick={() => setDay(d)}
									className={cn(
										"rounded-md border px-2.5 py-1 text-xs",
										day === d ? "border-primary bg-primary/10" : "hover:bg-accent",
									)}
								>
									{WEEKDAY_LABELS[d]}
								</button>
							))}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label>Hours</Label>
						<div className="flex flex-wrap gap-1">
							{HOURS.map((h) => (
								<button
									key={h}
									type="button"
									onClick={() => toggleHour(h)}
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
						<div className="grid grid-cols-2 gap-3">
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

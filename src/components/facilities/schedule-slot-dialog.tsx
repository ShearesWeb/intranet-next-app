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
import { groupFacilitiesByType } from "@/lib/facilities/facility-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-first
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am … 11pm

interface ScheduleSlotDialogProps {
	open: boolean;
	facilities: Facility[];
	/** Pre-select the first facility of this type when opening (the active editor tab). */
	defaultType?: FacilityType;
	defaultDay?: number;
	defaultHour?: number;
	onClose: () => void;
	onSuccess: () => void;
}

export function ScheduleSlotDialog({
	open,
	facilities,
	defaultType,
	defaultDay,
	defaultHour,
	onClose,
	onSuccess,
}: ScheduleSlotDialogProps) {
	const [query, setQuery] = useState("");
	const [facilityId, setFacilityId] = useState<number | null>(null);
	const [days, setDays] = useState<number[]>([]);
	const [hours, setHours] = useState<number[]>([]);
	const [priority, setPriority] = useState<number>(1);
	const [activity, setActivity] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);

	// Reset to sensible defaults each time the dialog opens.
	useEffect(() => {
		if (!open) return;
		setQuery("");
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

	const groups = useMemo(() => groupFacilitiesByType(facilities, query), [facilities, query]);
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
					<DialogTitle>Add schedule slot</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					{/* Facility — searchable, grouped by type */}
					<div className="space-y-1.5">
						<Label htmlFor="facility-search">Facility</Label>
						<Input
							id="facility-search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search facilities…"
						/>
						<div className="max-h-40 overflow-y-auto rounded-md border" data-testid="facility-list">
							{groups.length === 0 ? (
								<p className="px-3 py-2 text-xs text-muted-foreground">No matching facilities.</p>
							) : (
								groups.map((g) => (
									<div key={g.type}>
										<div className="sticky top-0 flex items-center gap-1.5 bg-muted/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur">
											<span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
											{g.label}
										</div>
										{g.facilities.map((f) => (
											<button
												key={f.id}
												type="button"
												onClick={() => setFacilityId(f.id)}
												className={cn(
													"flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent",
													facilityId === f.id && "bg-primary/10",
												)}
											>
												<span className="truncate font-medium">{f.sub_venue}</span>
												{f.venue !== f.sub_venue && (
													<span className="truncate text-[10px] text-muted-foreground">{f.venue}</span>
												)}
											</button>
										))}
									</div>
								))
							)}
						</div>
						{selectedFacility && (
							<p className="text-[10px] text-muted-foreground">
								Selected: <span className="font-medium">{selectedFacility.sub_venue}</span>
							</p>
						)}
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

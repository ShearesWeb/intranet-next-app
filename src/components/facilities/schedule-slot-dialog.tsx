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
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am … 10pm (last slot 10–11pm)

/** When set, the dialog edits an existing window: it deletes these rows then recreates. */
export interface SlotEditTarget {
	ids: number[];
	facilityId: number;
	day: number;
	hours: number[];
	start_date: string | null;
	end_date: string | null;
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
	const [startDate, setStartDate] = useState<string>("");
	const [endDate, setEndDate] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);

	// Only Sheares facilities can receive schedules through the intranet.
	const selectableFacilities = useMemo(
		() => facilities.filter((f) => f.type === "sheares"),
		[facilities],
	);

	// Prefill from the edit target, else reset to sensible defaults, each time it opens.
	useEffect(() => {
		if (!open) return;
		if (editing) {
			setDays([editing.day]);
			setHours([...editing.hours]);
			setFacilityId(editing.facilityId);
			setStartDate(editing.start_date ?? "");
			setEndDate(editing.end_date ?? "");
			return;
		}
		setDays(defaultDay != null ? [defaultDay] : []);
		setHours(defaultHour != null ? [defaultHour] : []);
		setStartDate("");
		setEndDate("");
		const def =
			(defaultType && selectableFacilities.find((f) => f.type === defaultType)) ??
			selectableFacilities[0];
		setFacilityId(def?.id ?? null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	function toggleIn(list: number[], value: number): number[] {
		return list.includes(value)
			? list.filter((x) => x !== value)
			: [...list, value].sort((a, b) => a - b);
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
		if (startDate && endDate && startDate > endDate) {
			toast.error("Start date must be on or before end date");
			return;
		}

		const combos = days.flatMap((day) => hours.map((hour) => ({ day, hour })));
		setSubmitting(true);
		try {
			// Editing = replace: drop the old window's rows, then recreate from the form.
			if (editing) {
				await Promise.all(
					editing.ids.map((id) =>
						fetch(`/api/facilities/schedules?id=${id}`, { method: "DELETE" }).catch(
							() => undefined,
						),
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
							start_date: startDate || null,
							end_date: endDate || null,
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
						<FacilitySelect
							facilities={selectableFacilities}
							value={facilityId}
							onChange={setFacilityId}
						/>
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

					{/* Active period — blank = repeats indefinitely */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="start-date">Start date</Label>
							<Input
								id="start-date"
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="end-date">End date</Label>
							<Input
								id="end-date"
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
							/>
						</div>
						<p className="col-span-2 -mt-2 text-[10px] text-muted-foreground">
							Leave blank to repeat every week without an end.
						</p>
					</div>
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

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
import { Checkbox } from "@/components/ui/checkbox";
import { BOOKING_TYPE_CONFIG, BookingType } from "@/types/facilities";
import { toast } from "sonner";

interface SlotFormDialogProps {
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
	existingVenues: string[];
	existingSubVenues: string[];
}

const DAYS = [
	{ value: 0, label: "Sun" },
	{ value: 1, label: "Mon" },
	{ value: 2, label: "Tue" },
	{ value: 3, label: "Wed" },
	{ value: 4, label: "Thu" },
	{ value: 5, label: "Fri" },
	{ value: 6, label: "Sat" },
];

export function SlotFormDialog({
	open,
	onClose,
	onSuccess,
	existingVenues,
	existingSubVenues,
}: SlotFormDialogProps) {
	const [venue, setVenue] = useState("");
	const [subVenue, setSubVenue] = useState("");
	const [activity, setActivity] = useState("");
	const [timeFrom, setTimeFrom] = useState("09:00");
	const [timeTo, setTimeTo] = useState("10:00");
	const [type, setType] = useState<BookingType>("sheares");
	const [remark, setRemark] = useState("");
	const [recurring, setRecurring] = useState(false);
	const [date, setDate] = useState("");
	const [recurringStart, setRecurringStart] = useState("");
	const [recurringEnd, setRecurringEnd] = useState("");
	const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
	const [submitting, setSubmitting] = useState(false);

	function reset() {
		setVenue("");
		setSubVenue("");
		setActivity("");
		setTimeFrom("09:00");
		setTimeTo("10:00");
		setType("sheares");
		setRemark("");
		setRecurring(false);
		setDate("");
		setRecurringStart("");
		setRecurringEnd("");
		setDaysOfWeek([]);
	}

	function toggleDay(day: number) {
		setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
	}

	async function handleSubmit() {
		if (!venue.trim() || !subVenue.trim() || !activity.trim()) {
			toast.error("Venue, sub-venue, and activity are required");
			return;
		}
		if (timeFrom >= timeTo) {
			toast.error("Start time must be before end time");
			return;
		}
		if (!recurring && !date) {
			toast.error("Select a date");
			return;
		}
		if (recurring && (!recurringStart || !recurringEnd || daysOfWeek.length === 0)) {
			toast.error("Select start date, end date, and at least one day of the week");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/facilities/manage", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					venue: venue.trim(),
					sub_venue: subVenue.trim(),
					activity: activity.trim(),
					time_from: timeFrom,
					time_to: timeTo,
					type,
					remark: remark.trim() || null,
					date: recurring ? null : date,
					recurring,
					recurring_start: recurring ? recurringStart : null,
					recurring_end: recurring ? recurringEnd : null,
					days_of_week: recurring ? daysOfWeek : null,
				}),
			});

			const json = await res.json();

			if (!res.ok) {
				toast.error(json.error ?? "Failed to create slot");
				return;
			}

			const count = json.data?.length ?? 1;
			toast.success(`Created ${count} slot${count > 1 ? "s" : ""}`);
			reset();
			onClose();
			onSuccess();
		} catch {
			toast.error("Failed to create slot");
		} finally {
			setSubmitting(false);
		}
	}

	const uniqueVenues = [...new Set(existingVenues)].sort();
	const uniqueSubVenues = [...new Set(existingSubVenues)].sort();

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Facility Slot</DialogTitle>
				</DialogHeader>

				<div className="grid gap-4 py-2">
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Venue</Label>
							<Input
								value={venue}
								onChange={(e) => setVenue(e.target.value)}
								placeholder="e.g. Sheares Hall"
								list="venues-list"
							/>
							<datalist id="venues-list">
								{uniqueVenues.map((v) => (
									<option key={v} value={v} />
								))}
							</datalist>
						</div>
						<div className="space-y-1.5">
							<Label>Sub-venue</Label>
							<Input
								value={subVenue}
								onChange={(e) => setSubVenue(e.target.value)}
								placeholder="e.g. MPH Court 1"
								list="subvenues-list"
							/>
							<datalist id="subvenues-list">
								{uniqueSubVenues.map((v) => (
									<option key={v} value={v} />
								))}
							</datalist>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label>Activity</Label>
						<Input
							value={activity}
							onChange={(e) => setActivity(e.target.value)}
							placeholder="e.g. Basketball Practice"
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Start Time</Label>
							<Input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
						</div>
						<div className="space-y-1.5">
							<Label>End Time</Label>
							<Input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
						</div>
					</div>

					<div className="space-y-1.5">
						<Label>Booking Type</Label>
						<div className="flex flex-wrap gap-2">
							{(
								Object.entries(BOOKING_TYPE_CONFIG) as [
									BookingType,
									{ label: string; color: string },
								][]
							).map(([key, config]) => (
								<button
									key={key}
									type="button"
									onClick={() => setType(key)}
									className={`rounded-full border px-3 py-1 text-sm transition-colors ${
										type === key
											? "border-transparent text-white"
											: "border-border text-foreground hover:bg-accent"
									}`}
									style={type === key ? { backgroundColor: config.color } : undefined}
								>
									{config.label}
								</button>
							))}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label>Remark (optional)</Label>
						<Input
							value={remark}
							onChange={(e) => setRemark(e.target.value)}
							placeholder="Any notes..."
						/>
					</div>

					<div className="flex items-center gap-2 rounded-md border p-3">
						<Checkbox
							id="recurring"
							checked={recurring}
							onCheckedChange={(checked) => setRecurring(checked === true)}
						/>
						<Label htmlFor="recurring" className="cursor-pointer font-normal">
							Repeat weekly
						</Label>
					</div>

					{recurring ? (
						<>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<Label>From Date</Label>
									<Input
										type="date"
										value={recurringStart}
										onChange={(e) => setRecurringStart(e.target.value)}
									/>
								</div>
								<div className="space-y-1.5">
									<Label>To Date</Label>
									<Input
										type="date"
										value={recurringEnd}
										onChange={(e) => setRecurringEnd(e.target.value)}
									/>
								</div>
							</div>

							<div className="space-y-1.5">
								<Label>Days of Week</Label>
								<div className="flex flex-wrap gap-2">
									{DAYS.map((day) => (
										<button
											key={day.value}
											type="button"
											onClick={() => toggleDay(day.value)}
											className={`flex h-9 w-11 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
												daysOfWeek.includes(day.value)
													? "border-primary bg-primary text-primary-foreground"
													: "border-border text-foreground hover:bg-accent"
											}`}
										>
											{day.label}
										</button>
									))}
								</div>
							</div>
						</>
					) : (
						<div className="space-y-1.5">
							<Label>Date</Label>
							<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={submitting}>
						{submitting ? "Creating..." : recurring ? "Create Recurring Slots" : "Create Slot"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

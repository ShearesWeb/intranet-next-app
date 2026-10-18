"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarDays, Clock3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Facility, FacilitySchedule } from "@/types/facilities";

export const SCHEDULE_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const SCHEDULE_HOURS = Array.from({ length: 17 }, (_, index) => index + 6);

const DAY_LABELS: Record<number, string> = {
	0: "Sun",
	1: "Mon",
	2: "Tue",
	3: "Wed",
	4: "Thu",
	5: "Fri",
	6: "Sat",
};

interface FacilityScheduleCardProps {
	facility: Facility;
	schedules: FacilitySchedule[];
	onSave: (facilityId: number, days: number[], hours: number[]) => Promise<void>;
}

function compactHour(hour: number): string {
	const period = hour >= 12 ? "PM" : "AM";
	return `${hour % 12 || 12}${period}`;
}

function sortedUnique(values: number[]): number[] {
	return [...new Set(values)].sort((a, b) => a - b);
}

export function FacilityScheduleCard({ facility, schedules, onSave }: FacilityScheduleCardProps) {
	const scheduleSignature = useMemo(
		() =>
			schedules
				.map((schedule) => `${schedule.day_of_week}:${schedule.hour}`)
				.sort()
				.join("|"),
		[schedules],
	);
	const persistedDays = useMemo(
		() => sortedUnique(schedules.map((schedule) => schedule.day_of_week)),
		[scheduleSignature], // eslint-disable-line react-hooks/exhaustive-deps
	);
	const persistedHours = useMemo(
		() => sortedUnique(schedules.map((schedule) => schedule.hour)),
		[scheduleSignature], // eslint-disable-line react-hooks/exhaustive-deps
	);
	const [selectedDays, setSelectedDays] = useState<number[]>(persistedDays);
	const [selectedHours, setSelectedHours] = useState<number[]>(persistedHours);
	const [saving, setSaving] = useState(false);
	const previousSelection = useRef({ days: persistedDays, hours: persistedHours });

	useEffect(() => {
		setSelectedDays(persistedDays);
		setSelectedHours(persistedHours);
		if (persistedDays.length > 0 && persistedHours.length > 0) {
			previousSelection.current = { days: persistedDays, hours: persistedHours };
		}
	}, [scheduleSignature, persistedDays, persistedHours]);

	const isVisible = selectedDays.length > 0 && selectedHours.length > 0;
	const allDaysSelected = SCHEDULE_DAYS.every((day) => selectedDays.includes(day));
	const allHoursSelected = SCHEDULE_HOURS.every((hour) => selectedHours.includes(hour));
	const facilityName = facility.sub_venue || facility.venue;

	async function applySelection(nextDays: number[], nextHours: number[]) {
		const normalizedDays = SCHEDULE_DAYS.filter((day) => nextDays.includes(day));
		const normalizedHours = SCHEDULE_HOURS.filter((hour) => nextHours.includes(hour));
		const oldDays = selectedDays;
		const oldHours = selectedHours;

		setSelectedDays(normalizedDays);
		setSelectedHours(normalizedHours);

		if (normalizedDays.length > 0 && normalizedHours.length > 0) {
			previousSelection.current = { days: normalizedDays, hours: normalizedHours };
		} else if (schedules.length === 0) {
			// Keep an incomplete first selection locally until both dimensions have a value.
			return;
		}

		setSaving(true);
		try {
			await onSave(facility.id, normalizedDays, normalizedHours);
		} catch (error) {
			setSelectedDays(oldDays);
			setSelectedHours(oldHours);
			toast.error(error instanceof Error ? error.message : "Failed to update availability");
		} finally {
			setSaving(false);
		}
	}

	function toggleVisibility() {
		if (isVisible) {
			void applySelection([], []);
			return;
		}

		const days = previousSelection.current.days.length
			? previousSelection.current.days
			: [...SCHEDULE_DAYS];
		const hours = previousSelection.current.hours.length
			? previousSelection.current.hours
			: SCHEDULE_HOURS;
		void applySelection(days, hours);
	}

	function toggleDay(day: number) {
		void applySelection(
			selectedDays.includes(day)
				? selectedDays.filter((selectedDay) => selectedDay !== day)
				: [...selectedDays, day],
			selectedHours,
		);
	}

	function toggleHour(hour: number) {
		void applySelection(
			selectedDays,
			selectedHours.includes(hour)
				? selectedHours.filter((selectedHour) => selectedHour !== hour)
				: [...selectedHours, hour],
		);
	}

	return (
		<article className="overflow-hidden rounded-2xl border border-orange-100 bg-card shadow-sm">
			<header className="flex flex-wrap items-center justify-between gap-4 border-b border-orange-100 bg-orange-50/45 px-5 py-4 sm:px-6">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
						<Building2 className="size-5" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<h2 className="truncate text-lg font-semibold">{facilityName}</h2>
						{facility.sub_venue && facility.venue !== facility.sub_venue && (
							<p className="truncate text-sm text-muted-foreground">{facility.venue}</p>
						)}
					</div>
				</div>

				<div className="flex items-center gap-3">
					{saving && (
						<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
							Saving
						</span>
					)}
					<span
						className={cn(
							"text-sm font-medium",
							isVisible ? "text-emerald-700" : "text-muted-foreground",
						)}
					>
						{isVisible ? "Visible for booking" : "Hidden"}
					</span>
					<button
						type="button"
						role="switch"
						aria-checked={isVisible}
						aria-label={`Show ${facilityName} on Book Facilities`}
						disabled={saving}
						onClick={toggleVisibility}
						className={cn(
							"relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 disabled:cursor-wait disabled:opacity-60",
							isVisible ? "bg-emerald-600" : "bg-muted-foreground/30",
						)}
					>
						<span
							className={cn(
								"absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
								isVisible ? "translate-x-5" : "translate-x-0",
							)}
						/>
					</button>
				</div>
			</header>

			<div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(28rem,1.7fr)] lg:gap-10">
				<section aria-labelledby={`facility-${facility.id}-days`}>
					<div className="mb-3 flex items-center justify-between gap-3">
						<h3
							id={`facility-${facility.id}-days`}
							className="flex items-center gap-2 text-sm font-semibold"
						>
							<CalendarDays className="size-4 text-orange-600" aria-hidden="true" />
							Days available
						</h3>
						<button
							type="button"
							disabled={saving}
							onClick={() =>
								void applySelection(allDaysSelected ? [] : [...SCHEDULE_DAYS], selectedHours)
							}
							className="text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50"
						>
							{allDaysSelected ? "Clear all" : "Select all"}
						</button>
					</div>
					<div className="flex flex-wrap gap-2">
						{SCHEDULE_DAYS.map((day) => {
							const selected = selectedDays.includes(day);
							return (
								<button
									key={day}
									type="button"
									aria-pressed={selected}
									disabled={saving}
									onClick={() => toggleDay(day)}
									className={cn(
										"min-w-14 rounded-full border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60",
										selected
											? "border-orange-500 bg-orange-500 text-white"
											: "border-orange-200 bg-background text-foreground hover:bg-orange-50",
									)}
								>
									{DAY_LABELS[day]}
								</button>
							);
						})}
					</div>
				</section>

				<section aria-labelledby={`facility-${facility.id}-hours`}>
					<div className="mb-3 flex items-center justify-between gap-3">
						<h3
							id={`facility-${facility.id}-hours`}
							className="flex items-center gap-2 text-sm font-semibold"
						>
							<Clock3 className="size-4 text-orange-600" aria-hidden="true" />
							Timeslots available
						</h3>
						<button
							type="button"
							disabled={saving}
							onClick={() =>
								void applySelection(selectedDays, allHoursSelected ? [] : SCHEDULE_HOURS)
							}
							className="text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50"
						>
							{allHoursSelected ? "Clear all" : "Select all"}
						</button>
					</div>
					<div className="flex flex-wrap gap-2">
						{SCHEDULE_HOURS.map((hour) => {
							const selected = selectedHours.includes(hour);
							return (
								<button
									key={hour}
									type="button"
									aria-pressed={selected}
									disabled={saving}
									onClick={() => toggleHour(hour)}
									className={cn(
										"min-w-[3.5rem] rounded-full border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60",
										selected
											? "border-orange-500 bg-orange-500 text-white"
											: "border-orange-200 bg-background text-foreground hover:bg-orange-50",
									)}
								>
									{compactHour(hour)}
								</button>
							);
						})}
					</div>
				</section>
			</div>
		</article>
	);
}

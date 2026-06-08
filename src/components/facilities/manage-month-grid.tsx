"use client";

import { cn } from "@/lib/utils";
import { FacilityBooking, BOOKING_TYPE_CONFIG, BookingType } from "@/types/facilities";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type ManagedSlot = FacilityBooking & { claim_count: number };

interface ManageMonthGridProps {
	year: number;
	month: number;
	selectedDate: string | null;
	slots: ManagedSlot[];
	onSelectDate: (date: string) => void;
	onChangeMonth: (year: number, month: number) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
	return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
	return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
	return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthLabel(year: number, month: number): string {
	return new Date(year, month).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
}

export function ManageMonthGrid({
	year,
	month,
	selectedDate,
	slots,
	onSelectDate,
	onChangeMonth,
}: ManageMonthGridProps) {
	const daysInMonth = getDaysInMonth(year, month);
	const firstDay = getFirstDayOfMonth(year, month);
	const today = new Date().toISOString().split("T")[0];

	const slotsByDate = new Map<string, ManagedSlot[]>();
	for (const slot of slots) {
		const list = slotsByDate.get(slot.booked_date) ?? [];
		list.push(slot);
		slotsByDate.set(slot.booked_date, list);
	}

	function getDotsForDate(dateKey: string): BookingType[] {
		const daySlots = slotsByDate.get(dateKey) ?? [];
		const types = new Set<BookingType>();
		for (const s of daySlots) {
			types.add(s.type);
			if (types.size >= 4) break;
		}
		return [...types];
	}

	function prevMonth() {
		const m = month === 0 ? 11 : month - 1;
		const y = month === 0 ? year - 1 : year;
		onChangeMonth(y, m);
	}

	function nextMonth() {
		const m = month === 11 ? 0 : month + 1;
		const y = month === 11 ? year + 1 : year;
		onChangeMonth(y, m);
	}

	const cells: (number | null)[] = [];
	for (let i = 0; i < firstDay; i++) cells.push(null);
	for (let d = 1; d <= daysInMonth; d++) cells.push(d);

	return (
		<div className="w-full">
			<div className="mb-3 flex items-center justify-between">
				<Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<span className="text-sm font-semibold">{getMonthLabel(year, month)}</span>
				<Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>

			<div className="grid grid-cols-7 gap-px">
				{WEEKDAYS.map((wd) => (
					<div key={wd} className="py-1 text-center text-[10px] font-medium text-muted-foreground">
						{wd}
					</div>
				))}

				{cells.map((day, i) => {
					if (day === null) {
						return <div key={`empty-${i}`} className="aspect-square" />;
					}

					const dateKey = formatDateKey(year, month, day);
					const isToday = dateKey === today;
					const isSelected = dateKey === selectedDate;
					const dots = getDotsForDate(dateKey);
					const hasSlots = dots.length > 0;

					return (
						<button
							key={dateKey}
							onClick={() => onSelectDate(dateKey)}
							className={cn(
								"flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md text-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
								isSelected && "bg-primary font-semibold text-primary-foreground shadow-sm",
								!isSelected &&
									isToday &&
									"bg-primary/10 font-bold text-primary ring-1 ring-inset ring-primary/40",
								!isSelected && !isToday && hasSlots && "hover:bg-accent",
								!isSelected &&
									!isToday &&
									!hasSlots &&
									"text-muted-foreground/50 hover:bg-accent/50",
							)}
						>
							<span className="text-xs">{day}</span>
							{dots.length > 0 && (
								<div className="mt-0.5 flex gap-0.5">
									{dots.map((type) => (
										<span
											key={type}
											className="h-1.5 w-1.5 rounded-full"
											style={{ backgroundColor: BOOKING_TYPE_CONFIG[type].color }}
										/>
									))}
								</div>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

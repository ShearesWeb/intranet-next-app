"use client";

import { MonthGrid as SharedMonthGrid, type MonthGridDot } from "@/components/shared/month-grid";
import { BookingWithClaims, FACILITY_TYPE_CONFIG, FacilityType } from "@/types/facilities";

interface MonthGridProps {
	year: number;
	month: number;
	selectedDate: string | null;
	bookings: BookingWithClaims[];
	onSelectDate: (date: string) => void;
	onChangeMonth: (year: number, month: number) => void;
}

export function MonthGrid({
	year,
	month,
	selectedDate,
	bookings,
	onSelectDate,
	onChangeMonth,
}: MonthGridProps) {
	const byDate = new Map<string, BookingWithClaims[]>();
	for (const b of bookings) {
		const list = byDate.get(b.booked_date) ?? [];
		list.push(b);
		byDate.set(b.booked_date, list);
	}

	function getDots(dateKey: string): MonthGridDot[] {
		const day = byDate.get(dateKey) ?? [];
		const types = new Set<FacilityType>();
		for (const b of day) {
			types.add(b.type);
			if (types.size >= 4) break;
		}
		return [...types].map((type) => ({ key: type, color: FACILITY_TYPE_CONFIG[type].color }));
	}

	return (
		<SharedMonthGrid
			year={year}
			month={month}
			selectedDate={selectedDate}
			getDots={getDots}
			onSelectDate={onSelectDate}
			onChangeMonth={onChangeMonth}
		/>
	);
}
